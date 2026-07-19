// Browser-only encode step: decode → (resize) → re-encode. Designed to run in BOTH the Web Worker and
// the main thread, so it uses only APIs available in both (createImageBitmap, OffscreenCanvas), with a
// DOM <canvas> fallback reached only on the main thread when OffscreenCanvas is missing (old Safari).
//
// Re-encoding through a canvas ALWAYS discards EXIF/metadata — a privacy win and the reason we don't
// ship a fragile "keep EXIF" toggle in v1. Orientation is baked into the pixels via
// createImageBitmap({ imageOrientation: 'from-image' }) so rotated phone photos don't come out sideways.
//
// Two entry points share the resize/crop/re-encode core: encodeImage() decodes a Blob with the browser's
// native codecs (and owns the bitmap it creates); encodeBitmap() takes an ALREADY-DECODED, already-oriented
// bitmap — the HEIC path, where libheif decodes and its display() already applies the irot/EXIF rotation,
// so that path must NOT re-apply orientation. The caller owns and closes any bitmap it passes to encodeBitmap().

import {
  planDimensions,
  planCrop,
  resolveOutputFormat,
  MIME,
  MAX_CANVAS_EDGE,
  type FormatChoice,
  type OutputFormat,
  type ResizeSettings,
} from './compress-math';
import { searchQualityForTarget } from './compress-core';

// Source rectangle to sample when centre-cropping (exactCrop mode); undefined draws the whole bitmap.
type Crop = { sx: number; sy: number; sw: number; sh: number };

export type EncodeRequest = {
  quality: number; // 0..1
  format: FormatChoice;
  resize: ResizeSettings;
  maxArea?: number; // device-safe output area cap (see safeMaxArea); undefined → no area clamp
  targetBytes?: number; // when set, search quality (and downscale) to land at ≤ this many bytes
};

export type EncodeResult = {
  blob: Blob;
  outFormat: OutputFormat;
  width: number;
  height: number;
  downscaled: boolean;
  approximated?: boolean; // targetBytes was requested but couldn't be reached → closest result
};

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;
type AnyCtx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); // main-thread only (guarded above)
  c.width = w;
  c.height = h;
  return c;
}

function get2d(canvas: AnyCanvas): AnyCtx | null {
  return 'convertToBlob' in canvas
    ? canvas.getContext('2d')
    : (canvas as HTMLCanvasElement).getContext('2d');
}

function canvasToBlob(canvas: AnyCanvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))), type, quality);
  });
}

// Probe WebP encoding once. Very old Safari silently produces a PNG from toBlob('image/webp'); we must
// NOT hand the user a PNG mislabeled as WebP, so we downgrade to JPEG instead. Cached for the session.
let webpProbe: Promise<boolean> | null = null;
function canEncodeWebp(): Promise<boolean> {
  if (!webpProbe) {
    webpProbe = (async () => {
      try {
        const c = makeCanvas(1, 1);
        // OffscreenCanvas.convertToBlob throws InvalidStateError unless a rendering context exists, so
        // the probe MUST obtain one first — otherwise WebP is wrongly reported unsupported and every
        // output silently downgrades to JPEG (breaking compress-webp and auto PNG→WebP).
        if (!get2d(c)) return false;
        const blob = await canvasToBlob(c, 'image/webp', 0.5);
        return blob.type === 'image/webp';
      } catch {
        return false;
      }
    })();
  }
  return webpProbe;
}

// Probe points (relative) used to tell a drawn canvas from a silently-blank one.
const PROBE_POINTS: [number, number][] = [
  [0.12, 0.12], [0.5, 0.12], [0.88, 0.12],
  [0.12, 0.5], [0.5, 0.5], [0.88, 0.5],
  [0.12, 0.88], [0.5, 0.88], [0.88, 0.88],
];

function distinctSamples(ctx: AnyCtx, w: number, h: number): number {
  const seen = new Set<string>();
  for (const [fx, fy] of PROBE_POINTS) {
    const x = Math.min(w - 1, Math.max(0, Math.floor(fx * w)));
    const y = Math.min(h - 1, Math.max(0, Math.floor(fy * h)));
    const d = ctx.getImageData(x, y, 1, 1).data;
    seen.add(`${d[0]},${d[1]},${d[2]},${d[3]}`);
    if (seen.size > 1) return seen.size; // clearly has content — early out
  }
  return seen.size;
}

// True if the canvas actually received the image. A canvas that came out uniform is only a FAILURE
// when the source has real content (fingerprinted cheaply in a 24×24 probe), so a legitimately flat
// image never false-fails. Catches platforms that silently draw nothing past a canvas limit.
function looksDrawn(ctx: AnyCtx, w: number, h: number, bitmap: ImageBitmap): boolean {
  if (distinctSamples(ctx, w, h) > 1) return true;
  try {
    const probe = makeCanvas(24, 24);
    const pctx = get2d(probe);
    if (!pctx) return true; // can't verify → don't false-fail
    pctx.drawImage(bitmap, 0, 0, 24, 24);
    return distinctSamples(pctx, 24, 24) <= 1; // source also uniform → uniform output is correct
  } catch {
    return true; // getImageData unavailable/tainted → don't false-fail
  }
}

// Draw the bitmap onto a fresh canvas at (w×h), verifying it isn't silently blank. Shared by the plain
// and target-size paths. With `crop` it samples a source rectangle (centre-crop to fill w×h); without,
// it scales the whole bitmap. Throws on an unusable context or a blank draw so we never fake a success.
function drawToCanvas(bitmap: ImageBitmap, w: number, h: number, outFormat: OutputFormat, crop?: Crop): AnyCanvas {
  const canvas = makeCanvas(w, h);
  const ctx = get2d(canvas);
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // JPEG has no alpha channel — paint white first so transparent regions don't render as black.
  if (outFormat === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  if (crop) ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  else ctx.drawImage(bitmap, 0, 0, w, h);
  // Guard against a silently-blank canvas (e.g., canvas-limit exceeded) → fail visibly, no fake success.
  if (!looksDrawn(ctx, w, h, bitmap)) throw new Error('blank output — the image may be too large for this device');
  return canvas;
}

// Dimension-downscale fallback for the target-size search: when even the lowest quality can't fit the
// budget, shrink the longest edge and try again, a bounded number of times. Better perceptual quality
// than crushing JPEG quality to the floor at full resolution for the same file size.
const TARGET_DIM_STEPS = 5;
const TARGET_DIM_FACTOR = 0.8;
const TARGET_MIN_EDGE = 64;

/** Search quality (and, if needed, dimensions) so the output lands at ≤ req.targetBytes. */
async function encodeToTarget(
  bitmap: ImageBitmap,
  baseW: number,
  baseH: number,
  baseDownscaled: boolean,
  outFormat: OutputFormat,
  targetBytes: number,
  crop?: Crop,
): Promise<EncodeResult> {
  const mime = MIME[outFormat];
  let w = baseW;
  let h = baseH;
  let downscaled = baseDownscaled;
  let last: EncodeResult | null = null;

  for (let step = 0; step <= TARGET_DIM_STEPS; step++) {
    const iw = Math.max(1, Math.round(w));
    const ih = Math.max(1, Math.round(h));
    const canvas = drawToCanvas(bitmap, iw, ih, outFormat, crop);
    const res = await searchQualityForTarget(
      async (q) => {
        const blob = await canvasToBlob(canvas, mime, q);
        return { blob, size: blob.size };
      },
      targetBytes,
    );
    if (res.blob.size === 0) throw new Error('empty output');
    last = { blob: res.blob, outFormat, width: iw, height: ih, downscaled, approximated: !res.fits };
    if (res.fits) return last;

    // Even the quality floor overshot → shrink dimensions and retry (unless we've hit the size floor).
    const nextLongest = Math.max(w, h) * TARGET_DIM_FACTOR;
    if (nextLongest < TARGET_MIN_EDGE) break;
    w *= TARGET_DIM_FACTOR;
    h *= TARGET_DIM_FACTOR;
    downscaled = true;
  }
  // Couldn't reach the target even at the smallest size — hand back the closest (smallest) output.
  return last!;
}

/** Decode `source`, resize/crop/clamp per `req`, re-encode as JPEG or WebP. Strips metadata by construction. */
export async function encodeImage(source: Blob, req: EncodeRequest): Promise<EncodeResult> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    return await encodeBitmap(bitmap, source.type, req);
  } finally {
    bitmap.close();
  }
}

/**
 * Resize/crop/clamp an ALREADY-DECODED, already-oriented `bitmap` per `req`, re-encode as JPEG or WebP.
 * `sourceType` drives auto format resolution (e.g. 'image/heic' → JPEG). Used by the HEIC path, where
 * libheif has already applied the irot/EXIF rotation — so this MUST NOT re-apply orientation. The CALLER
 * owns and closes `bitmap`. Strips metadata by construction (nothing is carried across the canvas).
 */
export async function encodeBitmap(bitmap: ImageBitmap, sourceType: string, req: EncodeRequest): Promise<EncodeResult> {
  let outFormat = resolveOutputFormat(sourceType, req.format);
  if (outFormat === 'webp' && !(await canEncodeWebp())) outFormat = 'jpeg';

  // Build the draw plan: exactCrop → centre-crop to an exact box; everything else → scale-to-fit.
  let width: number;
  let height: number;
  let downscaled: boolean;
  let crop: Crop | undefined;
  if (req.resize.mode === 'exactCrop' && (req.resize.width ?? 0) > 0 && (req.resize.height ?? 0) > 0) {
    const cp = planCrop(bitmap.width, bitmap.height, req.resize.width!, req.resize.height!, MAX_CANVAS_EDGE);
    width = cp.width;
    height = cp.height;
    downscaled = cp.downscaled;
    crop = { sx: cp.sx, sy: cp.sy, sw: cp.sw, sh: cp.sh };
  } else {
    const pd = planDimensions(bitmap.width, bitmap.height, req.resize, MAX_CANVAS_EDGE, req.maxArea);
    width = pd.width;
    height = pd.height;
    downscaled = pd.downscaled;
  }

  if (req.targetBytes && req.targetBytes > 0) {
    return await encodeToTarget(bitmap, width, height, downscaled, outFormat, req.targetBytes, crop);
  }

  const canvas = drawToCanvas(bitmap, width, height, outFormat, crop);
  const blob = await canvasToBlob(canvas, MIME[outFormat], req.quality);
  if (blob.size === 0) throw new Error('empty output');
  return { blob, outFormat, width, height, downscaled };
}

export type { FormatChoice, OutputFormat, ResizeSettings };
