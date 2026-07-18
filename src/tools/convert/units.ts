// Pure, locale-independent unit-conversion engine. No DOM, no React — unit-tested in units.test.ts.
// Unit IDs are language-neutral; human labels live in the i18n dictionaries. Every linear unit stores
// its `factor` = how many BASE units one of it equals (base unit has factor 1). Temperature is affine,
// not a simple scale, so it is handled separately via Celsius as the pivot.

export type CategoryId =
  | 'length' | 'mass' | 'temperature' | 'area' | 'volume' | 'speed' | 'time' | 'digital';

export const CATEGORY_IDS: CategoryId[] = [
  'length', 'mass', 'temperature', 'area', 'volume', 'speed', 'time', 'digital',
];

// Linear categories: base unit + { unitId: factor-in-base-units }. Order here is the UI display order.
// Traditional East-Asian units use exact fractions where one exists (e.g. pyeong = 400/121 m²) so the
// value never carries rounding error — see docs/unit-converter-research.md.
type LinearCategory = { base: string; units: Record<string, number> };

const LINEAR: Record<Exclude<CategoryId, 'temperature'>, LinearCategory> = {
  length: {
    base: 'm',
    units: {
      m: 1, km: 1000, cm: 0.01, mm: 0.001, um: 1e-6, nm: 1e-9,
      mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, nmi: 1852,
      // KO 자/척 · JA 尺 (shaku) = 10/33 m ≈ 30.3 cm; KO 치/촌 · JA 寸 (sun) = one-tenth of that.
      shaku: 10 / 33, sun: 1 / 33,
    },
  },
  mass: {
    base: 'kg',
    units: {
      kg: 1, g: 0.001, mg: 1e-6, t: 1000,
      lb: 0.45359237, oz: 0.028349523125, st: 6.35029318, ct: 0.0002,
      // KO 돈 (don) = JA 匁 (monme) = 3.75 g; KO 근 (geun) meat/general = 600 g, produce = 375 g;
      // JA 貫 (kan) = 3.75 kg; JA 斤 (kin) = 600 g. geun and kin are the same value but display per-locale.
      don: 0.00375, geun: 0.6, geun_produce: 0.375, kan: 3.75, monme: 0.00375, kin: 0.6,
    },
  },
  area: {
    base: 'm2',
    units: {
      m2: 1, km2: 1e6, cm2: 1e-4, mm2: 1e-6, ha: 10000,
      mi2: 2589988.110336, acre: 4046.8564224, ft2: 0.09290304, in2: 0.00064516, yd2: 0.83612736,
      // KO 평 · JA 坪 (pyeong/tsubo) = 400/121 m² ≈ 3.3058 (same unit, shared factor);
      // JA 畳/帖 (jō) = ½ pyeong = 200/121 m² ≈ 1.6529.
      pyeong: 400 / 121, jo: 200 / 121,
    },
  },
  volume: {
    base: 'l',
    units: {
      l: 1, ml: 0.001, m3: 1000, cm3: 0.001,
      gal_us: 3.785411784, gal_uk: 4.54609, qt_us: 0.946352946, pt_us: 0.473176473,
      floz_us: 0.0295735295625, tbsp_us: 0.01478676478125, tsp_us: 0.00492892159375,
      // Cooking "cup" is not one value — it must be pickable: US legal 240 mL, metric (AU/NZ/CA) 250 mL,
      // Japan 200 mL. See research §3.5.
      cup_us: 0.24, cup_metric: 0.25, cup_jp: 0.2,
      // JA 升 (shō) = 2401/1331 L ≈ 1.8039; 合 (gō) = one-tenth of a shō.
      sho: 2401 / 1331, go: 2401 / 13310,
    },
  },
  speed: {
    base: 'mps',
    units: { mps: 1, kmh: 1 / 3.6, mph: 0.44704, knot: 0.514444444444, fts: 0.3048 },
  },
  time: {
    base: 's',
    units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800 },
  },
  digital: {
    base: 'byte',
    units: {
      bit: 0.125, byte: 1,
      // SI (decimal, 1000-based) and IEC (binary, 1024-based) both ship — see research §1.
      kb: 1e3, mb: 1e6, gb: 1e9, tb: 1e12, pb: 1e15,
      kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4,
    },
  },
};

export const TEMPERATURE_UNITS = ['c', 'f', 'k'] as const;

// Temperature via Celsius pivot: <unit> → °C → <unit>.
function toCelsius(unit: string, v: number): number {
  switch (unit) {
    case 'c': return v;
    case 'f': return (v - 32) * 5 / 9;
    case 'k': return v - 273.15;
    default: throw new Error(`unknown temperature unit: ${unit}`);
  }
}
function fromCelsius(unit: string, c: number): number {
  switch (unit) {
    case 'c': return c;
    case 'f': return c * 9 / 5 + 32;
    case 'k': return c + 273.15;
    default: throw new Error(`unknown temperature unit: ${unit}`);
  }
}

/** Ordered list of unit IDs for a category (UI display order). */
export function unitsOf(category: CategoryId): string[] {
  if (category === 'temperature') return [...TEMPERATURE_UNITS];
  return Object.keys(LINEAR[category].units);
}

/** The base unit ID of a category. */
export function baseUnit(category: CategoryId): string {
  return category === 'temperature' ? 'c' : LINEAR[category].base;
}

/** True if `unit` belongs to `category`. */
export function isUnit(category: CategoryId, unit: string): boolean {
  return unitsOf(category).includes(unit);
}

/**
 * Convert `value` from one unit to another within a category. Throws on an unknown unit so callers
 * (and tests) fail loudly rather than silently producing NaN.
 */
export function convert(category: CategoryId, from: string, to: string, value: number): number {
  if (category === 'temperature') return fromCelsius(to, toCelsius(from, value));
  const units = LINEAR[category].units;
  const f = units[from];
  const t = units[to];
  if (f === undefined) throw new Error(`unknown ${category} unit: ${from}`);
  if (t === undefined) throw new Error(`unknown ${category} unit: ${to}`);
  return (value * f) / t;
}

// --- Locale-aware number parsing/formatting ------------------------------------------------------
// Intl.NumberFormat handles OUTPUT for every locale for free, but has no parse method, so localized
// INPUT (e.g. German "1.234,5") must be parsed manually. We derive each locale's group/decimal symbols
// from Intl itself rather than hard-coding them. See research §3.1.

function separatorsFor(locale: string): { group: string; decimal: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(11111.1);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
  };
}

/**
 * Parse a user-typed number string in the given locale's convention. Returns null for empty/invalid
 * input (so the UI can show a hint instead of NaN). Strips the locale's grouping separator and spaces,
 * normalizes its decimal separator to '.', then validates.
 */
export function parseLocaleNumber(input: string, locale: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (s === '') return null;
  const { group, decimal } = separatorsFor(locale);
  // Drop ASCII, non-breaking, and narrow-no-break spaces (used as group separators in some locales).
  s = s.replace(/\s/g, '');
  if (group) s = s.split(group).join('');
  if (decimal && decimal !== '.') s = s.split(decimal).join('.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Format a converted value for display in the given locale (grouping + localized decimal). */
export function formatNumber(value: number, locale: string, maxFractionDigits = 6): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(value);
}
