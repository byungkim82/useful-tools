import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  percentSaved,
  outputFilename,
  resolveOutputFormat,
  mayFlattenAlpha,
  planDimensions,
  presetQuality,
  defaultFormatForSlug,
  isImageSlug,
  MAX_CANVAS_EDGE,
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
});

// --- queue reducer -------------------------------------------------------------------------------

const f = (id: string, size = 1000) => ({ id, name: `${id}.jpg`, size, type: 'image/jpeg' });
const withJobs = (...files: ReturnType<typeof f>[]): QueueState =>
  reducer(initialState, { type: 'add', files });

describe('queue reducer', () => {
  it('add appends queued jobs', () => {
    const s = withJobs(f('a'), f('b'));
    expect(s.jobs.map((j) => j.status)).toEqual(['queued', 'queued']);
  });
  it('happy path queued → processing → done carries the result', () => {
    let s = withJobs(f('a'));
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
    let s = withJobs(f('a'));
    s = reducer(s, { type: 'fail', id: 'a', error: 'boom' }); // still queued → ignored
    expect(s.jobs[0].status).toBe('queued');
    s = reducer(s, { type: 'start', id: 'a' });
    s = reducer(s, { type: 'fail', id: 'a', error: 'boom' });
    expect(s.jobs[0].status).toBe('error');
    expect(s.jobs[0].error).toBe('boom');
  });
  it('succeed does NOT resurrect a canceled job', () => {
    let s = withJobs(f('a'));
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
    let s = withJobs(f('a'), f('b'), f('c'));
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
    let s = withJobs(f('a'), f('b'));
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
    let s = withJobs(f('a'), f('b'), f('c'), f('d'));
    expect(nextRunnable(s, 2)).toEqual(['a', 'b']);
    s = reducer(s, { type: 'start', id: 'a' });
    expect(nextRunnable(s, 2)).toEqual(['b']); // one slot left
    s = reducer(s, { type: 'start', id: 'b' });
    expect(nextRunnable(s, 2)).toEqual([]); // full
  });
  it('queueStats sums done jobs only', () => {
    let s = withJobs(f('a', 1000), f('b', 2000));
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
