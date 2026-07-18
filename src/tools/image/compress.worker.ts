// Dedicated Web Worker that runs the encode step off the main thread, so a batch of images never janks
// the UI. Bundled via `new Worker(new URL('./compress.worker.ts', import.meta.url))` (see runner.ts) —
// verified to emit a same-origin chunk under output:'export' + Turbopack. Uses only worker-safe APIs
// (createImageBitmap, OffscreenCanvas) through encode.ts. If the platform can't run it, runner.ts falls
// back to the main thread.

import { encodeImage, type EncodeRequest } from './encode';
import type { OutputFormat } from './compress-math';

export type WorkerIn = { id: string; file: Blob; req: EncodeRequest };
export type WorkerOut =
  | { id: string; ok: true; blob: Blob; outFormat: OutputFormat; width: number; height: number; downscaled: boolean }
  | { id: string; ok: false; error: string };

// One-arg postMessage (the worker global's signature); cast avoids the DOM Window.postMessage overload
// that would demand a targetOrigin. tsconfig uses the DOM lib, so `self` is typed as a window here.
const post = (msg: WorkerOut) => (self as unknown as { postMessage: (m: WorkerOut) => void }).postMessage(msg);

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { id, file, req } = e.data;
  try {
    const r = await encodeImage(file, req);
    post({ id, ok: true, blob: r.blob, outFormat: r.outFormat, width: r.width, height: r.height, downscaled: r.downscaled });
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
