// Chooses how each file is processed. Non-HEIC images use a shared Web Worker when the platform supports
// Worker + OffscreenCanvas + createImageBitmap (keeps a batch non-janky), else run straight on the main
// thread; if that worker dies, in-flight and future non-HEIC jobs transparently fall back to the main
// thread. HEIC/HEIF instead go through a SEPARATE libheif worker (loaded lazily on the first HEIC file, so
// its ~1.4 MB never burdens non-HEIC users). HEIC has NO main-thread fallback — the browser's native
// decoder can't read HEIC — so if that worker can't run, the job fails with HEIC_UNSUPPORTED and the UI
// tells the user their browser is unsupported.

import { encodeImage, type EncodeRequest, type EncodeResult } from './encode';
import type { WorkerIn, WorkerOut } from './compress.worker';

type Pending = { resolve: (r: EncodeResult) => void; reject: (e: Error) => void };
const WORKER_DOWN = 'worker-unavailable';
/** Rejection reason for a HEIC job the platform can't run (no Worker/OffscreenCanvas, or the worker
 *  crashed). There is no main-thread fallback for HEIC, so the client maps this to an "unsupported
 *  browser" message rather than a generic failure. */
export const HEIC_UNSUPPORTED = 'heic-unsupported';

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

/** True when a file must go through the libheif decoder worker instead of the browser-native path. */
export function isHeic(file: { type: string; name?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if (HEIC_TYPES.has(type)) return true;
  // Some platforms give HEIC files an empty MIME type; fall back to the extension.
  if (!type && typeof file.name === 'string') return /\.(heic|heif)$/i.test(file.name);
  return false;
}

export class CompressRunner {
  private worker: Worker | null = null; // browser-native encode (compress.js)
  private heicWorker: Worker | null = null; // libheif decode (heic.js), created on first HEIC job
  private heicDisabled = false;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private capable: boolean;

  constructor() {
    this.capable =
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap !== 'undefined';
    if (!this.capable) return;
    try {
      // Loaded from public/workers/compress.js (built by scripts/build-worker.mjs), not bundled by Next —
      // see that script for why. Same-origin classic worker, covered by CSP default-src 'self'.
      this.worker = new Worker('/workers/compress.js');
      this.wire(this.worker, () => this.disableStd());
    } catch {
      this.disableStd();
    }
  }

  private wire(w: Worker, onDown: () => void) {
    w.onmessage = (e: MessageEvent<WorkerOut>) => this.onMessage(e.data);
    w.onerror = onDown;
    w.onmessageerror = onDown;
  }

  private onMessage(msg: WorkerOut) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.ok) {
      p.resolve({ blob: msg.blob, outFormat: msg.outFormat, width: msg.width, height: msg.height, downscaled: msg.downscaled, approximated: msg.approximated });
    } else {
      p.reject(new Error(msg.error));
    }
  }

  // Reject every in-flight job whose id has this prefix ('j' = std, 'h' = HEIC) with a reason.
  private rejectPending(prefix: string, reason: string) {
    for (const [id, p] of this.pending) {
      if (id.startsWith(prefix)) {
        this.pending.delete(id);
        p.reject(new Error(reason));
      }
    }
  }

  private disableStd() {
    this.worker?.terminate();
    this.worker = null;
    this.rejectPending('j', WORKER_DOWN); // std jobs retry on the main thread (see compress())
  }

  private disableHeic() {
    this.heicWorker?.terminate();
    this.heicWorker = null;
    this.heicDisabled = true;
    this.rejectPending('h', HEIC_UNSUPPORTED); // no main-thread fallback for HEIC
  }

  private getHeicWorker(): Worker | null {
    if (this.heicWorker || this.heicDisabled || !this.capable) return this.heicWorker;
    try {
      this.heicWorker = new Worker('/workers/heic.js');
      this.wire(this.heicWorker, () => this.disableHeic());
    } catch {
      this.disableHeic();
    }
    return this.heicWorker;
  }

  /** Compress/convert one file. HEIC/HEIF → libheif worker (no fallback); else the shared worker, with a
   *  one-shot main-thread retry if it dies. */
  compress(file: Blob, req: EncodeRequest): Promise<EncodeResult> {
    if (isHeic(file)) return this.convertHeic(file, req);
    const worker = this.worker;
    if (!worker) return encodeImage(file, req);
    const id = `j${this.seq++}`;
    return new Promise<EncodeResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerIn = { id, file, req };
      worker.postMessage(msg);
    }).catch((err: Error) => {
      if (err.message === WORKER_DOWN) return encodeImage(file, req); // worker died → main-thread retry
      throw err;
    });
  }

  private convertHeic(file: Blob, req: EncodeRequest): Promise<EncodeResult> {
    const worker = this.getHeicWorker();
    if (!worker) return Promise.reject(new Error(HEIC_UNSUPPORTED));
    const id = `h${this.seq++}`;
    return new Promise<EncodeResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerIn = { id, file, req };
      worker.postMessage(msg);
    });
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.heicWorker?.terminate();
    this.heicWorker = null;
    this.pending.clear();
  }
}
