// Dedicated Web Worker for HEIC/HEIF input. libheif (WASM) decodes the file to RGBA — its display()
// already applies the irot/EXIF rotation (verified in the P0-a spike), so the pixels come out upright and
// we must NOT re-orient. We hand the oriented bitmap to encodeBitmap(), the shared resize/re-encode step,
// so HEIC gets resize / target-size / presets / crop for free.
//
// This is a SEPARATE worker from compress.js on purpose: libheif's ~1.4 MB is bundled only here (built by
// scripts/build-worker.mjs into public/workers/heic.js), so the compressor never pays for it — the worker
// is constructed only when a HEIC file actually appears (see runner.ts). Reuses the compress.worker
// message protocol so the runner talks to either worker the same way. Classic iife worker, same-origin,
// covered by CSP default-src 'self' + the wasm-unsafe-eval script-src delta.

import libheif from 'libheif-js/wasm-bundle';
import { encodeBitmap } from './encode';
import type { WorkerIn, WorkerOut } from './compress.worker';

const post = (msg: WorkerOut) => (self as unknown as { postMessage: (m: WorkerOut) => void }).postMessage(msg);

// Decode a HEIC/HEIF buffer to an already-oriented ImageBitmap via libheif. Takes the primary (first)
// image; multi-image containers (bursts / Live Photos) beyond the first are out of scope for v1.
async function decodeToBitmap(buf: ArrayBuffer): Promise<ImageBitmap> {
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(new Uint8Array(buf));
  if (!images || images.length === 0) throw new Error('no image found in HEIC file');
  const image = images[0];
  const width = image.get_width();
  const height = image.get_height();
  if (!width || !height) throw new Error('HEIC image has no dimensions');
  // libheif fills this RGBA buffer; a real ImageData works as both the display() target and, once filled,
  // a createImageBitmap source — no intermediate canvas needed.
  const imageData = new ImageData(width, height);
  await new Promise<void>((resolve, reject) => {
    image.display(imageData, (out: unknown) => (out ? resolve() : reject(new Error('HEIC decode failed'))));
  });
  return createImageBitmap(imageData);
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const { id, file, req } = e.data;
  try {
    const bitmap = await decodeToBitmap(await file.arrayBuffer());
    try {
      // sourceType 'image/heic' → resolveOutputFormat maps auto to JPEG (see compress-math).
      const r = await encodeBitmap(bitmap, 'image/heic', req);
      post({ id, ok: true, blob: r.blob, outFormat: r.outFormat, width: r.width, height: r.height, downscaled: r.downscaled, approximated: r.approximated });
    } finally {
      bitmap.close();
    }
  } catch (err) {
    post({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
