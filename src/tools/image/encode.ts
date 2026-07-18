// Browser-only encode step: decode → (resize) → re-encode. Designed to run in BOTH the Web Worker and
// the main thread, so it uses only APIs available in both (createImageBitmap, OffscreenCanvas), with a
// DOM <canvas> fallback reached only on the main thread when OffscreenCanvas is missing (old Safari).
//
// Re-encoding through a canvas ALWAYS discards EXIF/metadata — a privacy win and the reason we don't
// ship a fragile "keep EXIF" toggle in v1. Orientation is baked into the pixels via
// createImageBitmap({ imageOrientation: 'from-image' }) so rotated phone photos don't come out sideways.

import {
  planDimensions,
  resolveOutputFormat,
  MIME,
  MAX_CANVAS_EDGE,
  type FormatChoice,
  type OutputFormat,
  type ResizeSettings,
} from './compress-math';

export type EncodeRequest = {
  quality: number; // 0..1
  format: FormatChoice;
  resize: ResizeSettings;
  maxArea?: number; // device-safe output area cap (see safeMaxArea); undefined → no area clamp
};

export type EncodeResult = {
  blob: Blob;
  outFormat: OutputFormat;
  width: number;
  height: number;
  downscaled: boolean;
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

/** Decode `source`, resize/clamp per `req`, re-encode as JPEG or WebP. Strips metadata by construction. */
export async function encodeImage(source: Blob, req: EncodeRequest): Promise<EncodeResult> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const { width, height, downscaled } = planDimensions(
      bitmap.width,
      bitmap.height,
      req.resize,
      MAX_CANVAS_EDGE,
      req.maxArea,
    );
    let outFormat = resolveOutputFormat(source.type, req.format);
    if (outFormat === 'webp' && !(await canEncodeWebp())) outFormat = 'jpeg';

    const canvas = makeCanvas(width, height);
    const ctx = get2d(canvas);
    if (!ctx) throw new Error('2d context unavailable');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // JPEG has no alpha channel — paint white first so transparent regions don't render as black.
    if (outFormat === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Guard against a silently-blank canvas (e.g., canvas-limit exceeded) → fail visibly, no fake success.
    if (!looksDrawn(ctx, width, height, bitmap)) throw new Error('blank output — the image may be too large for this device');

    const blob = await canvasToBlob(canvas, MIME[outFormat], req.quality);
    if (blob.size === 0) throw new Error('empty output');
    return { blob, outFormat, width, height, downscaled };
  } finally {
    bitmap.close();
  }
}

export type { FormatChoice, OutputFormat, ResizeSettings };
