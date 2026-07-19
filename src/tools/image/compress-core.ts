// Pure target-size search: given an injected encoder that turns a quality in [0,1] into a sized blob,
// find the HIGHEST quality whose output still fits within a byte budget (best visual quality under the
// cap), via binary search. DOM/React-free so the convergence logic is unit-tested with a fake encoder
// (no browser). The browser wiring — decode once, draw the canvas, and downscale dimensions when even
// the lowest quality overshoots — lives in encode.ts and calls this.

export type SizedBlob = { blob: Blob; size: number };

/** Encode the already-drawn image at `quality` (0..1) and report the resulting blob + its byte size. */
export type QualityEncoder = (quality: number) => Promise<SizedBlob>;

export type TargetSearchOptions = {
  minQuality?: number; // quality floor — below this we'd rather downscale dimensions (default 0.4)
  maxQuality?: number; // quality ceiling (default 0.95)
  maxIterations?: number; // binary-search refinement steps between the bounds (default 7)
};

export type TargetSearchResult = SizedBlob & {
  quality: number; // the quality that produced `blob`
  fits: boolean; // true when size ≤ targetBytes; false when even minQuality overshoots
  encodeCount: number; // how many times the encoder ran (for tests / budget reasoning)
};

const DEFAULTS = { minQuality: 0.4, maxQuality: 0.95, maxIterations: 7 };

/**
 * Highest-quality output whose size ≤ `targetBytes`, searching quality in [minQuality, maxQuality].
 *
 * - If maxQuality already fits, returns it (can't do better than the ceiling).
 * - If even minQuality overshoots, returns the minQuality result with `fits: false` — the caller then
 *   downscales dimensions and tries again. We never crush quality below the floor to chase a target.
 * - Otherwise binary-searches for the largest quality that still fits.
 *
 * Assumes size grows monotonically with quality (true for JPEG/WebP canvas encoding).
 */
export async function searchQualityForTarget(
  encode: QualityEncoder,
  targetBytes: number,
  opts: TargetSearchOptions = {},
): Promise<TargetSearchResult> {
  const minQ = opts.minQuality ?? DEFAULTS.minQuality;
  const maxQ = opts.maxQuality ?? DEFAULTS.maxQuality;
  const iterations = opts.maxIterations ?? DEFAULTS.maxIterations;
  let encodeCount = 0;
  const run = async (q: number): Promise<SizedBlob> => {
    encodeCount++;
    return encode(q);
  };

  // The ceiling already fits → nothing to search, use the best quality.
  const hi = await run(maxQ);
  if (hi.size <= targetBytes) return { ...hi, quality: maxQ, fits: true, encodeCount };

  // Even the floor overshoots → signal the caller to downscale dimensions; this is our smallest output.
  const lo = await run(minQ);
  if (lo.size > targetBytes) return { ...lo, quality: minQ, fits: false, encodeCount };

  // Bracketed: lo fits, hi doesn't. Binary-search the largest quality that still fits.
  let best: SizedBlob & { quality: number } = { ...lo, quality: minQ };
  let loQ = minQ;
  let hiQ = maxQ;
  for (let i = 0; i < iterations; i++) {
    const mid = (loQ + hiQ) / 2;
    const r = await run(mid);
    if (r.size <= targetBytes) {
      best = { ...r, quality: mid }; // fits — keep it and try for higher quality
      loQ = mid;
    } else {
      hiQ = mid; // too big — lower the quality
    }
  }
  return { ...best, fits: true, encodeCount };
}
