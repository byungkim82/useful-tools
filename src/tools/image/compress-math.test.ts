import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  percentSaved,
  outputFilename,
  resolveOutputFormat,
  mayFlattenAlpha,
  planDimensions,
  planCrop,
  presetQuality,
  defaultFormatForSlug,
  isImageSlug,
  applyUsePreset,
  USE_PRESETS,
  MAX_CANVAS_EDGE,
  safeMaxArea,
  type Settings,
} from './compress-math';
import {
  reducer,
  initialState,
  decideConcurrency,
  nextRunnable,
  queueStats,
  type QueueState,
} from './queue-reducer';
import { crc32, zipStore, uniqueName } from './zip-store';
import { withTimeout } from './async-util';
import { searchQualityForTarget } from './compress-core';

describe('formatBytes', () => {
  it('bytes / KB / MB / GB with decimal units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(1000)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(12_400_000)).toBe('12.4 MB');
    expect(formatBytes(3_100_000)).toBe('3.1 MB');
    expect(formatBytes(2_500_000_000)).toBe('2.5 GB');
  });
  it('empty for invalid', () => {
    expect(formatBytes(NaN)).toBe('');
    expect(formatBytes(-1)).toBe('');
  });
});

describe('percentSaved', () => {
  it('rounds the reduction', () => {
    expect(percentSaved(1000, 320)).toBe(68);
    expect(percentSaved(1000, 1000)).toBe(0);
    expect(percentSaved(1000, 500)).toBe(50);
  });
  it('negative when the file grew, 0 when original is 0', () => {
    expect(percentSaved(1000, 1200)).toBe(-20);
    expect(percentSaved(0, 100)).toBe(0);
  });
});

describe('outputFilename', () => {
  it('swaps extension and adds -min', () => {
    expect(outputFilename('photo.png', 'webp')).toBe('photo-min.webp');
    expect(outputFilename('IMG_1234.JPG', 'jpeg')).toBe('IMG_1234-min.jpg');
    expect(outputFilename('a.b.c.jpeg', 'webp')).toBe('a.b.c-min.webp');
  });
  it('handles names without an extension', () => {
    expect(outputFilename('photo', 'jpeg')).toBe('photo-min.jpg');
  });
});

describe('resolveOutputFormat', () => {
  it('explicit choice wins', () => {
    expect(resolveOutputFormat('image/png', 'jpeg')).toBe('jpeg');
    expect(resolveOutputFormat('image/jpeg', 'webp')).toBe('webp');
  });
  it('auto keeps jpeg/webp, sends png/other to webp', () => {
    expect(resolveOutputFormat('image/jpeg', 'auto')).toBe('jpeg');
    expect(resolveOutputFormat('image/webp', 'auto')).toBe('webp');
    expect(resolveOutputFormat('image/png', 'auto')).toBe('webp');
    expect(resolveOutputFormat('image/gif', 'auto')).toBe('webp');
    expect(resolveOutputFormat('', 'auto')).toBe('webp');
  });
});

describe('mayFlattenAlpha', () => {
  it('true only for jpeg output from an alpha-capable source', () => {
    expect(mayFlattenAlpha('image/png', 'jpeg')).toBe(true);
    expect(mayFlattenAlpha('image/png', 'webp')).toBe(false);
    expect(mayFlattenAlpha('image/jpeg', 'jpeg')).toBe(false);
  });
});

describe('presetQuality / slug helpers', () => {
  it('preset maps to fixed quality; custom uses the slider value', () => {
    expect(presetQuality('high', 0.5)).toBeCloseTo(0.92, 9);
    expect(presetQuality('balanced', 0.5)).toBeCloseTo(0.8, 9);
    expect(presetQuality('smallest', 0.5)).toBeCloseTo(0.6, 9);
    expect(presetQuality('custom', 0.37)).toBeCloseTo(0.37, 9);
  });
  it('defaultFormatForSlug + isImageSlug', () => {
    expect(defaultFormatForSlug('compress-jpg')).toBe('jpeg');
    expect(defaultFormatForSlug('compress-webp')).toBe('webp');
    expect(defaultFormatForSlug('image-compressor')).toBe('auto');
    expect(isImageSlug('image-compressor')).toBe(true);
    expect(isImageSlug('length-converter')).toBe(false);
  });
});

describe('planDimensions', () => {
  it('none keeps size when within the canvas ceiling', () => {
    expect(planDimensions(1920, 1080, { mode: 'none' })).toEqual({ width: 1920, height: 1080, downscaled: false });
  });
  it('maxDimension shrinks the longest edge, preserves aspect, never upscales', () => {
    expect(planDimensions(4000, 2000, { mode: 'maxDimension', maxDimension: 1000 })).toEqual({
      width: 1000,
      height: 500,
      downscaled: false,
    });
    // already smaller than the cap → unchanged (no upscale)
    expect(planDimensions(800, 600, { mode: 'maxDimension', maxDimension: 2000 })).toEqual({
      width: 800,
      height: 600,
      downscaled: false,
    });
  });
  it('percentage scales both axes, clamps >100 to 100', () => {
    expect(planDimensions(1000, 500, { mode: 'percentage', percentage: 50 })).toEqual({
      width: 500,
      height: 250,
      downscaled: false,
    });
    expect(planDimensions(1000, 500, { mode: 'percentage', percentage: 250 })).toEqual({
      width: 1000,
      height: 500,
      downscaled: false,
    });
  });
  it('exact with aspect lock fits inside the box without upscaling', () => {
    expect(planDimensions(4000, 3000, { mode: 'exact', width: 800, height: 800, lockAspect: true })).toEqual({
      width: 800,
      height: 600,
      downscaled: false,
    });
    // box larger than source → no upscale
    expect(planDimensions(400, 300, { mode: 'exact', width: 4000, height: 4000, lockAspect: true })).toEqual({
      width: 400,
      height: 300,
      downscaled: false,
    });
  });
  it('exact without aspect lock honours explicit dimensions', () => {
    expect(planDimensions(4000, 3000, { mode: 'exact', width: 200, height: 100, lockAspect: false })).toEqual({
      width: 200,
      height: 100,
      downscaled: false,
    });
  });
  it('clamps an oversized image to the canvas edge and flags downscaled', () => {
    const r = planDimensions(20000, 10000, { mode: 'none' });
    expect(r.width).toBe(MAX_CANVAS_EDGE);
    expect(r.height).toBe(MAX_CANVAS_EDGE / 2);
    expect(r.downscaled).toBe(true);
  });
  it('never returns a zero dimension', () => {
    const r = planDimensions(10000, 1, { mode: 'maxDimension', maxDimension: 100 });
    expect(r.width).toBe(100);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
  it('clamps by total area (not just edge) and flags downscaled', () => {
    // 8000×4000 = 32MP, within the 8192 edge but over a 16.7M area cap → area clamp kicks in.
    const r = planDimensions(8000, 4000, { mode: 'none' }, 8192, 16_777_216);
    expect(r.width * r.height).toBeLessThanOrEqual(16_777_216);
    expect(r.downscaled).toBe(true);
    expect(r.width / r.height).toBeCloseTo(2, 2); // aspect preserved
  });
  it('area clamp is a no-op when under the cap', () => {
    const r = planDimensions(3000, 2000, { mode: 'none' }, 8192, 16_777_216); // 6MP < 16.7M
    expect(r).toEqual({ width: 3000, height: 2000, downscaled: false });
  });
});

describe('planCrop', () => {
  it('outputs the exact target box, centre-cropping a square source to portrait', () => {
    const r = planCrop(1000, 1000, 413, 531);
    expect(r.width).toBe(413);
    expect(r.height).toBe(531);
    // portrait target from a square source → crop the width, keep full height
    expect(Math.round(r.sh)).toBe(1000);
    expect(r.sw).toBeLessThan(1000);
    expect(r.sy).toBe(0);
    expect(r.sx).toBeGreaterThan(0);
    // the sampled rectangle matches the target aspect (so no distortion)
    expect(r.sw / r.sh).toBeCloseTo(413 / 531, 3);
  });
  it('crops the height of a wide source for a portrait box', () => {
    const r = planCrop(2000, 1000, 413, 531);
    expect(r.sh).toBe(1000); // full height used
    expect(r.sw).toBeLessThan(2000);
    expect(r.sx).toBeGreaterThan(0);
    expect(r.sy).toBe(0);
  });
  it('clamps a box larger than the canvas ceiling and flags downscaled', () => {
    const r = planCrop(20000, 20000, 10000, 10000, MAX_CANVAS_EDGE);
    expect(Math.max(r.width, r.height)).toBe(MAX_CANVAS_EDGE);
    expect(r.downscaled).toBe(true);
  });
});

describe('applyUsePreset', () => {
  const base: Settings = {
    preset: 'balanced',
    quality: 0.8,
    format: 'auto',
    resize: { mode: 'none', maxDimension: 1920, percentage: 80, width: 1280, height: 1280, lockAspect: true },
    target: { enabled: false, kb: 200 },
  };
  const byId = (id: string) => USE_PRESETS.find((p) => p.id === id)!;

  it('ID photo preset sets an exact crop + jpeg + a target, keeping the rest', () => {
    const s = applyUsePreset(base, byId('idphoto'));
    expect(s.format).toBe('jpeg');
    expect(s.resize.mode).toBe('exactCrop');
    expect(s.resize.width).toBe(413);
    expect(s.resize.height).toBe(531);
    expect(s.target).toEqual({ enabled: true, kb: 200 });
    expect(s.preset).toBe('balanced'); // untouched
  });
  it('WhatsApp preset caps the longest edge and enables a 100 KB target', () => {
    const s = applyUsePreset(base, byId('whatsapp'));
    expect(s.format).toBe('auto');
    expect(s.resize.mode).toBe('maxDimension');
    expect(s.resize.maxDimension).toBe(1600);
    expect(s.target).toEqual({ enabled: true, kb: 100 });
  });
  it('all four presets enable a target and keep resize sub-fields from the base', () => {
    for (const p of USE_PRESETS) {
      const s = applyUsePreset(base, p);
      expect(s.target.enabled).toBe(true);
      expect(s.resize.percentage).toBe(80); // base sub-field preserved through the merge
    }
  });
});

describe('safeMaxArea', () => {
  it('mobile gets the most conservative cap', () => {
    expect(safeMaxArea({ mobile: true })).toBe(16_777_216);
  });
  it('low-memory desktop is capped below full desktop', () => {
    expect(safeMaxArea({ deviceMemory: 4 })).toBe(33_554_432);
    expect(safeMaxArea({ deviceMemory: 16 })).toBe(MAX_CANVAS_EDGE * MAX_CANVAS_EDGE);
  });
  it('default desktop is edge-governed (8192²)', () => {
    expect(safeMaxArea()).toBe(MAX_CANVAS_EDGE * MAX_CANVAS_EDGE);
  });
});

// --- queue reducer -------------------------------------------------------------------------------

const f = (id: string, size = 1000) => ({ id, name: `${id}.jpg`, size, type: 'image/jpeg' });
const withJobs = (...files: ReturnType<typeof f>[]): QueueState =>
  reducer(initialState, { type: 'add', files });
// add + startAll → jobs are 'queued' (submitted for compression).
const submitted = (...files: ReturnType<typeof f>[]): QueueState =>
  reducer(withJobs(...files), { type: 'startAll' });

describe('queue reducer', () => {
  it('add appends pending jobs; startAll submits them to queued', () => {
    const s = withJobs(f('a'), f('b'));
    expect(s.jobs.map((j) => j.status)).toEqual(['pending', 'pending']);
    const q = reducer(s, { type: 'startAll' });
    expect(q.jobs.map((j) => j.status)).toEqual(['queued', 'queued']);
  });
  it('happy path queued → processing → done carries the result', () => {
    let s = submitted(f('a'));
    s = reducer(s, { type: 'start', id: 'a' });
    expect(s.jobs[0].status).toBe('processing');
    s = reducer(s, {
      type: 'succeed',
      id: 'a',
      result: { outSize: 320, outWidth: 800, outHeight: 600, outFormat: 'webp', downscaled: false },
    });
    expect(s.jobs[0].status).toBe('done');
    expect(s.jobs[0].outSize).toBe(320);
    expect(s.jobs[0].outFormat).toBe('webp');
  });
  it('fail only applies to a processing job', () => {
    let s = submitted(f('a'));
    s = reducer(s, { type: 'fail', id: 'a', error: 'boom' }); // still queued → ignored
    expect(s.jobs[0].status).toBe('queued');
    s = reducer(s, { type: 'start', id: 'a' });
    s = reducer(s, { type: 'fail', id: 'a', error: 'boom' });
    expect(s.jobs[0].status).toBe('error');
    expect(s.jobs[0].error).toBe('boom');
  });
  it('succeed does NOT resurrect a canceled job', () => {
    let s = submitted(f('a'));
    s = reducer(s, { type: 'start', id: 'a' });
    s = reducer(s, { type: 'cancel', id: 'a' });
    expect(s.jobs[0].status).toBe('canceled');
    s = reducer(s, {
      type: 'succeed',
      id: 'a',
      result: { outSize: 1, outWidth: 1, outHeight: 1, outFormat: 'jpeg', downscaled: false },
    });
    expect(s.jobs[0].status).toBe('canceled'); // guard held
  });
  it('cancelAll cancels queued+processing but leaves done alone', () => {
    let s = submitted(f('a'), f('b'), f('c'));
    s = reducer(s, { type: 'start', id: 'a' });
    s = reducer(s, {
      type: 'succeed',
      id: 'a',
      result: { outSize: 1, outWidth: 1, outHeight: 1, outFormat: 'jpeg', downscaled: false },
    });
    s = reducer(s, { type: 'start', id: 'b' });
    s = reducer(s, { type: 'cancelAll' });
    expect(s.jobs.map((j) => j.status)).toEqual(['done', 'canceled', 'canceled']);
  });
  it('remove / clear', () => {
    let s = withJobs(f('a'), f('b'));
    s = reducer(s, { type: 'remove', id: 'a' });
    expect(s.jobs.map((j) => j.id)).toEqual(['b']);
    s = reducer(s, { type: 'clear' });
    expect(s.jobs).toEqual([]);
  });
  it('requeue resets a done job to a clean queued state', () => {
    let s = submitted(f('a'), f('b'));
    s = reducer(s, { type: 'start', id: 'a' });
    s = reducer(s, {
      type: 'succeed',
      id: 'a',
      result: { outSize: 300, outWidth: 8, outHeight: 6, outFormat: 'webp', downscaled: true },
    });
    s = reducer(s, { type: 'requeue', ids: ['a'] });
    expect(s.jobs[0].status).toBe('queued');
    expect(s.jobs[0].outSize).toBeUndefined();
    expect(s.jobs[0].downscaled).toBeUndefined();
    expect(s.jobs[1].status).toBe('queued'); // untouched
  });
});

describe('decideConcurrency', () => {
  it('pixel-area thresholds on desktop', () => {
    expect(decideConcurrency(500_000)).toBe(3); // small
    expect(decideConcurrency(4_000_000)).toBe(2); // medium
    expect(decideConcurrency(12_000_000)).toBe(1); // large
  });
  it('mobile is always 1', () => {
    expect(decideConcurrency(100_000, { mobile: true })).toBe(1);
  });
  it('low Chromium deviceMemory caps at 2', () => {
    expect(decideConcurrency(500_000, { deviceMemory: 4 })).toBe(2);
    expect(decideConcurrency(500_000, { deviceMemory: 8 })).toBe(3);
  });
  it('never exceeds cores-1, never below 1', () => {
    expect(decideConcurrency(500_000, { hardwareConcurrency: 2 })).toBe(1);
    expect(decideConcurrency(500_000, { hardwareConcurrency: 1 })).toBe(1);
  });
});

describe('nextRunnable + queueStats', () => {
  it('fills open slots from the queue head', () => {
    let s = submitted(f('a'), f('b'), f('c'), f('d'));
    expect(nextRunnable(s, 2)).toEqual(['a', 'b']);
    s = reducer(s, { type: 'start', id: 'a' });
    expect(nextRunnable(s, 2)).toEqual(['b']); // one slot left
    s = reducer(s, { type: 'start', id: 'b' });
    expect(nextRunnable(s, 2)).toEqual([]); // full
  });
  it('queueStats sums done jobs only', () => {
    let s = submitted(f('a', 1000), f('b', 2000));
    s = reducer(s, { type: 'start', id: 'a' });
    s = reducer(s, {
      type: 'succeed',
      id: 'a',
      result: { outSize: 300, outWidth: 1, outHeight: 1, outFormat: 'webp', downscaled: false },
    });
    s = reducer(s, { type: 'start', id: 'b' });
    const st = queueStats(s);
    expect(st).toMatchObject({ total: 2, done: 1, processing: 1, originalBytes: 1000, outputBytes: 300 });
  });
});

// --- zip-store -----------------------------------------------------------------------------------

describe('crc32', () => {
  it('matches the standard "123456789" vector', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('empty input is 0', () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe('zipStore', () => {
  it('emits valid PKZIP structure with correct signatures and entry count', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new TextEncoder().encode('hello world');
    const zip = zipStore([
      { name: 'a.bin', data: a },
      { name: 'b.txt', data: b },
    ]);
    const dv = new DataView(zip.buffer);
    // starts with a local file header
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    // ends with an EOCD record: signature 22 bytes from the end, declaring 2 entries
    const eocd = zip.length - 22;
    expect(dv.getUint32(eocd, true)).toBe(0x06054b50);
    expect(dv.getUint16(eocd + 10, true)).toBe(2);
    // the raw file data is embedded verbatim (store, not compressed)
    const joined = Array.from(zip).join(',');
    expect(joined).toContain(Array.from(a).join(','));
  });
  it('stores the correct CRC in the local header', () => {
    const data = new TextEncoder().encode('123456789');
    const zip = zipStore([{ name: 'x', data }]);
    const dv = new DataView(zip.buffer);
    expect(dv.getUint32(14, true)).toBe(0xcbf43926); // CRC field of the local header
  });
});

describe('uniqueName', () => {
  it('suffixes collisions before the extension', () => {
    const used = new Set<string>();
    expect(uniqueName('photo-min.webp', used)).toBe('photo-min.webp');
    expect(uniqueName('photo-min.webp', used)).toBe('photo-min (2).webp');
    expect(uniqueName('photo-min.webp', used)).toBe('photo-min (3).webp');
  });
});

describe('withTimeout', () => {
  it('passes through a value that settles in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });
  it('rejects with "timed out" when the promise hangs', async () => {
    const never = new Promise<number>(() => {});
    await expect(withTimeout(never, 20)).rejects.toThrow(/timed out/);
  });
  it('propagates the original rejection when it settles first', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});

// --- compress-core: target-size quality search ---------------------------------------------------

// Fake encoder: output size grows linearly with quality (monotonic, like real JPEG/WebP canvas encoding).
const linearEncoder = (bytesAtFull: number) => async (q: number) => {
  const size = Math.round(bytesAtFull * q);
  return { blob: { size } as unknown as Blob, size };
};

describe('searchQualityForTarget', () => {
  it('returns the ceiling immediately when the best quality already fits', async () => {
    const r = await searchQualityForTarget(linearEncoder(1000), 2000);
    expect(r.fits).toBe(true);
    expect(r.quality).toBeCloseTo(0.95, 9);
    expect(r.size).toBe(950);
    expect(r.encodeCount).toBe(1); // one probe, no search needed
  });

  it('finds the highest quality whose output stays under the budget', async () => {
    const r = await searchQualityForTarget(linearEncoder(1000), 500); // size = 1000·q → fits when q ≤ 0.5
    expect(r.fits).toBe(true);
    expect(r.size).toBeLessThanOrEqual(500);
    expect(r.quality).toBeGreaterThan(0.49); // budget nearly used
    expect(r.quality).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('signals fits:false when even the quality floor overshoots (caller then downscales)', async () => {
    const r = await searchQualityForTarget(linearEncoder(1000), 300); // floor 0.4 → 400 > 300
    expect(r.fits).toBe(false);
    expect(r.quality).toBeCloseTo(0.4, 9);
    expect(r.size).toBe(400);
    expect(r.encodeCount).toBe(2); // ceiling probe + floor probe, then bail
  });

  it('honours custom quality bounds', async () => {
    const r = await searchQualityForTarget(linearEncoder(1000), 10_000, { minQuality: 0.1, maxQuality: 0.8 });
    expect(r.fits).toBe(true);
    expect(r.quality).toBeCloseTo(0.8, 9);
  });

  it('bounds the encoder calls to 2 probes + maxIterations', async () => {
    const r = await searchQualityForTarget(linearEncoder(1000), 500, { maxIterations: 7 });
    expect(r.encodeCount).toBeLessThanOrEqual(9);
  });
});
