// Pure, DOM-free logic for the image compressor: resize planning, output-format resolution, byte
// formatting, filenames, and quality presets. No React, no browser APIs — unit-tested in
// compress-math.test.ts. The browser-only encode step lives in encode.ts and consumes these.

export type OutputFormat = 'jpeg' | 'webp';
export type FormatChoice = 'auto' | OutputFormat;
export type Preset = 'high' | 'balanced' | 'smallest' | 'custom';
// 'exactCrop' fills an exact W×H box by scaling to cover then centre-cropping the overflow (ID photos).
export type ResizeMode = 'none' | 'maxDimension' | 'percentage' | 'exact' | 'exactCrop';

export type ResizeSettings = {
  mode: ResizeMode;
  maxDimension?: number; // px, applied to the longest edge (shrink-only)
  percentage?: number; // 1..100 (shrink-only)
  width?: number; // exact / exactCrop mode
  height?: number; // exact / exactCrop mode
  lockAspect?: boolean; // exact mode: fit inside the box preserving aspect (default true)
};

// Global compression settings — the pure data shape shared by the panel, the hook and the presets.
export type TargetSettings = { enabled: boolean; kb: number };
export type Settings = {
  preset: Preset;
  quality: number; // slider value used when preset === 'custom'
  format: FormatChoice;
  resize: ResizeSettings;
  target: TargetSettings;
};

// One-click use-case presets: a format + resize + target-size combo tuned for a common destination.
// Data only (labels live in labels.ts). Same locales, translated labels — see AskUserQuestion decision.
export type UsePresetId = 'whatsapp' | 'email' | 'web' | 'idphoto';
export type UsePreset = {
  id: UsePresetId;
  format: FormatChoice;
  resize: Partial<ResizeSettings> & { mode: ResizeMode };
  targetKb: number;
};
export const USE_PRESETS: readonly UsePreset[] = [
  { id: 'whatsapp', format: 'auto', resize: { mode: 'maxDimension', maxDimension: 1600 }, targetKb: 100 },
  { id: 'email', format: 'auto', resize: { mode: 'maxDimension', maxDimension: 2048 }, targetKb: 300 },
  { id: 'web', format: 'webp', resize: { mode: 'maxDimension', maxDimension: 1920 }, targetKb: 200 },
  { id: 'idphoto', format: 'jpeg', resize: { mode: 'exactCrop', width: 413, height: 531 }, targetKb: 200 },
];

/** Apply a use-case preset over the current settings: sets format, resize and target, keeps the rest. */
export function applyUsePreset(base: Settings, preset: UsePreset): Settings {
  return {
    ...base,
    format: preset.format,
    resize: { ...base.resize, ...preset.resize },
    target: { enabled: true, kb: preset.targetKb },
  };
}

// The three quality presets shown as buttons. `custom` = the raw slider value, no preset.
export const PRESET_QUALITY: Record<Exclude<Preset, 'custom'>, number> = {
  high: 0.92,
  balanced: 0.8,
  smallest: 0.6,
};

// Browsers cap the maximum canvas dimension. iOS Safari was historically ~4096², modern engines
// 8192²–16384². We clamp the longest edge to a conservative cross-browser ceiling so an oversized
// photo downscales instead of producing a blank canvas / crashing. Surfaced to the user via a badge
// (planDimensions reports `downscaled`), never silently.
export const MAX_CANVAS_EDGE = 8192;

/**
 * A safe maximum output AREA (in pixels) for the device. Browsers cap canvas by total area, not just
 * edge — iOS Safari historically ~16.7M px (4096²) — and constrained devices run out of memory sooner.
 * Clamping by area (not only edge) prevents a silently-blank canvas on those platforms: better a
 * downscale + badge than a broken output. Desktop returns a high cap so the edge limit governs there.
 */
export function safeMaxArea(hints: { mobile?: boolean; deviceMemory?: number } = {}): number {
  if (hints.mobile) return 16_777_216; // 4096² — conservative for iOS Safari / phones
  if (hints.deviceMemory !== undefined && hints.deviceMemory <= 4) return 33_554_432; // ~5792², low-memory desktop
  return MAX_CANVAS_EDGE * MAX_CANVAS_EDGE; // 8192² — desktop is effectively edge-governed
}

export const MIME: Record<OutputFormat, string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
export const EXT: Record<OutputFormat, string> = {
  jpeg: 'jpg',
  webp: 'webp',
};

// v1 slugs. `image-compressor` is the primary (auto format); the other two pin an output format.
export const IMAGE_SLUGS = ['image-compressor', 'compress-jpg', 'compress-webp'] as const;
export type ImageSlug = (typeof IMAGE_SLUGS)[number];

export function isImageSlug(slug: string): slug is ImageSlug {
  return (IMAGE_SLUGS as readonly string[]).includes(slug);
}

// HEIC converter slugs — their own group 'heic'. heic-to-jpg is the primary (JPG output, the common
// need); heic-to-webp pins WebP output. Both reuse the compressor pipeline via the libheif decode worker.
export const HEIC_SLUGS = ['heic-to-jpg', 'heic-to-webp'] as const;
export type HeicSlug = (typeof HEIC_SLUGS)[number];

export function isHeicSlug(slug: string): slug is HeicSlug {
  return (HEIC_SLUGS as readonly string[]).includes(slug);
}

/** Default output-format choice implied by the tool slug. */
export function defaultFormatForSlug(slug: string): FormatChoice {
  if (slug === 'compress-jpg' || slug === 'heic-to-jpg') return 'jpeg';
  if (slug === 'compress-webp' || slug === 'heic-to-webp') return 'webp';
  return 'auto';
}

/** Quality [0,1] for a preset; `custom` returns the given fallback (the live slider value). */
export function presetQuality(preset: Preset, custom: number): number {
  return preset === 'custom' ? custom : PRESET_QUALITY[preset];
}

/**
 * Human-readable byte size using decimal units (matches how file managers report photo sizes):
 * 900 → "900 B", 1536 → "1.5 KB", 12_400_000 → "12.4 MB". One decimal, trailing ".0" dropped.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1000;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  const rounded = Math.round(v * 10) / 10;
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${s} ${units[i]}`;
}

/** Percent reduction from original to output, rounded. 1000→320 ⇒ 68. Negative when the file grew. */
export function percentSaved(originalBytes: number, outputBytes: number): number {
  if (!(originalBytes > 0)) return 0;
  return Math.round((1 - outputBytes / originalBytes) * 100);
}

/** Clamp a percentage to [0, 100]; non-finite input falls back to 50 (the compare-slider centre). */
export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

/** Output filename: swap the extension for the format's and add a "-min" suffix. photo.png → photo-min.webp */
export function outputFilename(originalName: string, format: OutputFormat): string {
  const dot = originalName.lastIndexOf('.');
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  return `${stem}-min.${EXT[format]}`;
}

/**
 * Resolve the effective output format from the source MIME and the user's choice.
 * `auto`: keep JPEG/WebP as-is; HEIC/HEIF → JPEG (camera photos, no alpha, the expected conversion
 * target); PNG/GIF/other → WebP (preserves possible alpha, strong ratio).
 */
export function resolveOutputFormat(sourceType: string, choice: FormatChoice): OutputFormat {
  if (choice === 'jpeg' || choice === 'webp') return choice;
  if (sourceType === 'image/webp') return 'webp';
  if (sourceType === 'image/jpeg' || sourceType === 'image/jpg') return 'jpeg';
  if (sourceType === 'image/heic' || sourceType === 'image/heif') return 'jpeg';
  return 'webp'; // png, gif, bmp, unknown
}

/** True when encoding this source as JPEG would flatten transparency (source format can carry alpha). */
export function mayFlattenAlpha(sourceType: string, format: OutputFormat): boolean {
  return format === 'jpeg' && (sourceType === 'image/png' || sourceType === 'image/gif' || sourceType === 'image/webp');
}

export type ResizePlan = { width: number; height: number; downscaled: boolean };

/**
 * Target draw dimensions for a (srcW × srcH) source. Applies the resize settings (all shrink-only
 * except non-locked exact, which honours the user's explicit numbers), then clamps the longest edge to
 * `maxEdge`. `downscaled` is true ONLY when that canvas-edge clamp kicked in — i.e. the image was too
 * large for the canvas and we had to shrink it beyond what the user asked, which the UI badges.
 */
export function planDimensions(
  srcW: number,
  srcH: number,
  resize: ResizeSettings,
  maxEdge = MAX_CANVAS_EDGE,
  maxArea = Infinity,
): ResizePlan {
  let w = srcW;
  let h = srcH;

  switch (resize.mode) {
    case 'maxDimension': {
      const d = resize.maxDimension ?? 0;
      const longest = Math.max(srcW, srcH);
      if (d > 0 && longest > d) {
        const f = d / longest;
        w = srcW * f;
        h = srcH * f;
      }
      break;
    }
    case 'percentage': {
      const p = Math.min(Math.max(resize.percentage ?? 100, 1), 100); // shrink-only
      const f = p / 100;
      w = srcW * f;
      h = srcH * f;
      break;
    }
    case 'exact': {
      const tw = resize.width ?? 0;
      const th = resize.height ?? 0;
      if (resize.lockAspect ?? true) {
        // Fit inside the given box (whichever axes are provided), never upscaling.
        const boxW = tw > 0 ? tw : Infinity;
        const boxH = th > 0 ? th : Infinity;
        const f = Math.min(boxW / srcW, boxH / srcH, 1);
        if (Number.isFinite(f)) {
          w = srcW * f;
          h = srcH * f;
        }
      } else {
        if (tw > 0) w = tw;
        if (th > 0) h = th;
      }
      break;
    }
    case 'none':
    default:
      break;
  }

  let downscaled = false;
  const longest = Math.max(w, h);
  if (longest > maxEdge) {
    const f = maxEdge / longest;
    w *= f;
    h *= f;
    downscaled = true;
  }
  // Clamp by total AREA too (platform canvas-area limit / memory), after the edge clamp.
  if (Number.isFinite(maxArea) && w * h > maxArea) {
    const f = Math.sqrt(maxArea / (w * h));
    w *= f;
    h *= f;
    downscaled = true;
  }

  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
    downscaled,
  };
}

export type CropPlan = {
  width: number; // output canvas width (== requested target, clamped to the canvas ceiling)
  height: number;
  sx: number; // source rectangle to sample (centre-crop), in source pixels
  sy: number;
  sw: number;
  sh: number;
  downscaled: boolean; // the requested box exceeded the canvas ceiling and had to shrink
};

/**
 * Plan an exact-size centre crop: scale the source to COVER the target box, then crop the overflow so
 * the output is exactly targetW×targetH with the centre of the image kept. Used for ID/passport photos.
 * The output box is clamped to `maxEdge` (rare — ID sizes are tiny) and that clamp sets `downscaled`.
 */
export function planCrop(srcW: number, srcH: number, targetW: number, targetH: number, maxEdge = MAX_CANVAS_EDGE): CropPlan {
  let tw = Math.max(1, Math.round(targetW));
  let th = Math.max(1, Math.round(targetH));
  let downscaled = false;
  const longest = Math.max(tw, th);
  if (longest > maxEdge) {
    const f = maxEdge / longest;
    tw = Math.max(1, Math.round(tw * f));
    th = Math.max(1, Math.round(th * f));
    downscaled = true;
  }
  const scale = Math.max(tw / srcW, th / srcH); // cover: the larger ratio fills both axes
  const sw = Math.min(srcW, tw / scale);
  const sh = Math.min(srcH, th / scale);
  const sx = Math.max(0, (srcW - sw) / 2);
  const sy = Math.max(0, (srcH - sh) / 2);
  return { width: tw, height: th, sx, sy, sw, sh, downscaled };
}
