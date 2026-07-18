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
  type FormatChoice,
  type OutputFormat,
  type ResizeSettings,
} from './compress-math';

export type EncodeRequest = {
  quality: number; // 0..1
  format: FormatChoice;
  resize: ResizeSettings;
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

/** Decode `source`, resize/clamp per `req`, re-encode as JPEG or WebP. Strips metadata by construction. */
export async function encodeImage(source: Blob, req: EncodeRequest): Promise<EncodeResult> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  try {
    const { width, height, downscaled } = planDimensions(bitmap.width, bitmap.height, req.resize);
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

    const blob = await canvasToBlob(canvas, MIME[outFormat], req.quality);
    return { blob, outFormat, width, height, downscaled };
  } finally {
    bitmap.close();
  }
}

export type { FormatChoice, OutputFormat, ResizeSettings };
