// Bundle the compression Web Worker into a single self-contained file at public/workers/compress.js.
//
// WHY THIS EXISTS: under `output: 'export'` + Turbopack, `new Worker(new URL('./x.ts', import.meta.url))`
// does NOT bundle a worker that has module imports — it emits the raw .ts source as a static asset and
// points the Worker at it, which fails to parse (TS syntax) and is served with the wrong MIME (.ts).
// So we bundle the worker ourselves with esbuild and drop the result in public/, which the export copies
// to out/workers/compress.js verbatim — a guaranteed same-origin .js served with the correct MIME. The
// pure resize/format logic (compress-math.ts) and the encode step (encode.ts) are bundled in from their
// single source, so there is no drift from the unit-tested code.
//
// Runs first in the `build` script, before `next build`, so the file exists when the export copies public/.
//
// TWO separate build() calls, one per worker — NOT one call with two entryPoints, because esbuild's
// `outfile` is single-entry only (two entries needs `outdir`, which would move compress.js). The HEIC
// worker bundles libheif (~1.4 MB) into its own file, so the compressor's compress.js stays tiny; encode.ts
// and compress-math.ts get bundled into both, but from the one source, so there is no drift.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const common = {
  bundle: true,
  format: 'iife', // classic worker: no module-worker MIME strictness, broadest browser support
  platform: 'browser',
  target: 'es2019',
  legalComments: 'none',
  logLevel: 'info',
};

async function buildWorker(entry, outfile) {
  await build({ ...common, entryPoints: [join(root, entry)], outfile: join(root, outfile) });
  console.log(`built ${outfile}`);
}

await buildWorker('src/tools/image/compress.worker.ts', 'public/workers/compress.js');
// HEIC decoder worker: libheif (WASM, wasm-unsafe-eval) is bundled here only. Loaded lazily by runner.ts
// the first time a HEIC/HEIF file appears, so non-HEIC users never download it.
await buildWorker('src/tools/image/heic.worker.ts', 'public/workers/heic.js');
