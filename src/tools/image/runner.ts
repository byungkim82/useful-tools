// Chooses how the encode step runs: a shared Web Worker when the platform supports Worker +
// OffscreenCanvas + createImageBitmap (keeps a batch non-janky), else straight on the main thread. If
// the worker fails to construct or crashes at runtime, in-flight and future jobs transparently fall
// back to the main thread — so the tool works everywhere; the worker is a pure progressive enhancement.

import { encodeImage, type EncodeRequest, type EncodeResult } from './encode';
import type { WorkerIn, WorkerOut } from './compress.worker';

type Pending = { resolve: (r: EncodeResult) => void; reject: (e: Error) => void };
const WORKER_DOWN = 'worker-unavailable';

export class CompressRunner {
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;

  constructor() {
    const capable =
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap !== 'undefined';
    if (!capable) return;
    try {
      // Loaded from public/workers/compress.js (built by scripts/build-worker.mjs), not bundled by
      // Next — see that script for why. Same-origin classic worker, covered by CSP default-src 'self'.
      this.worker = new Worker('/workers/compress.js');
      this.worker.onmessage = (e: MessageEvent<WorkerOut>) => this.onMessage(e.data);
      this.worker.onerror = () => this.disableWorker();
      this.worker.onmessageerror = () => this.disableWorker();
    } catch {
      this.disableWorker();
    }
  }

  private disableWorker() {
    this.worker?.terminate();
    this.worker = null;
    // Reject in-flight jobs with a sentinel so compress() retries them on the main thread.
    for (const [, p] of this.pending) p.reject(new Error(WORKER_DOWN));
    this.pending.clear();
  }

  private onMessage(msg: WorkerOut) {
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    if (msg.ok) {
      p.resolve({ blob: msg.blob, outFormat: msg.outFormat, width: msg.width, height: msg.height, downscaled: msg.downscaled });
    } else {
      p.reject(new Error(msg.error));
    }
  }

  /** Compress one file. Uses the worker when available; retries once on the main thread if it dies. */
  compress(file: Blob, req: EncodeRequest): Promise<EncodeResult> {
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

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }
}
