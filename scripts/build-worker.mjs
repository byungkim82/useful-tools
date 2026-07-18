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
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(root, 'src/tools/image/compress.worker.ts')],
  bundle: true,
  format: 'iife', // classic worker: no module-worker MIME strictness, broadest browser support
  platform: 'browser',
  target: 'es2019',
  outfile: join(root, 'public/workers/compress.js'),
  legalComments: 'none',
  logLevel: 'info',
});

console.log('built public/workers/compress.js');
