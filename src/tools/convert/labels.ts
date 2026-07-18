// Display labels for the unit converter, kept in CODE (not the per-locale JSON) — same rationale as
// QrTypeNav: these are shared across every converter category, so a code map is one edit, not an
// 8-tool × 6-locale dictionary change. Per-category JSON blocks carry only SEO copy.

import type { Locale } from '@/i18n/config';
import type { CategoryId } from './units';

// SEO slug per category (the registry slug + URL). Uses the higher-demand search word where it differs
// from the internal id ("weight" over "mass", "data" over "digital").
export const CATEGORY_SLUG: Record<CategoryId, string> = {
  length: 'length-converter',
  mass: 'weight-converter',
  temperature: 'temperature-converter',
  area: 'area-converter',
  volume: 'volume-converter',
  speed: 'speed-converter',
  time: 'time-converter',
  digital: 'data-converter',
};

/** Reverse of CATEGORY_SLUG: the category a converter slug belongs to (undefined if not one). */
export function categoryOfSlug(slug: string): CategoryId | undefined {
  return (Object.keys(CATEGORY_SLUG) as CategoryId[]).find((c) => CATEGORY_SLUG[c] === slug);
}

// Short category names — used by the type-switcher nav and the results heading.
export const CATEGORY_LABEL: Record<CategoryId, Record<Locale, string>> = {
  length: { ko: '길이', en: 'Length', es: 'Longitud', pt: 'Comprimento', ja: '長さ', de: 'Länge' },
  mass: { ko: '무게', en: 'Weight', es: 'Peso', pt: 'Peso', ja: '重さ', de: 'Gewicht' },
  temperature: { ko: '온도', en: 'Temperature', es: 'Temperatura', pt: 'Temperatura', ja: '温度', de: 'Temperatur' },
  area: { ko: '넓이', en: 'Area', es: 'Área', pt: 'Área', ja: '面積', de: 'Fläche' },
  volume: { ko: '부피', en: 'Volume', es: 'Volumen', pt: 'Volume', ja: '体積', de: 'Volumen' },
  speed: { ko: '속도', en: 'Speed', es: 'Velocidad', pt: 'Velocidade', ja: '速さ', de: 'Geschwindigkeit' },
  time: { ko: '시간', en: 'Time', es: 'Tiempo', pt: 'Tempo', ja: '時間', de: 'Zeit' },
  digital: { ko: '데이터 용량', en: 'Data', es: 'Datos', pt: 'Dados', ja: 'データ量', de: 'Daten' },
};

// UI chrome strings.
export const CHROME: Record<Locale, {
  placeholder: string; unit: string; results: string; copy: string; emptyHint: string;
}> = {
  ko: { placeholder: '값 입력', unit: '단위', results: '변환 결과', copy: '복사', emptyHint: '위에 숫자를 입력하면 변환됩니다.' },
  en: { placeholder: 'Enter a value', unit: 'Unit', results: 'Converted to', copy: 'Copy', emptyHint: 'Enter a number above to convert.' },
  es: { placeholder: 'Introduce un valor', unit: 'Unidad', results: 'Convertido a', copy: 'Copiar', emptyHint: 'Introduce un número arriba para convertir.' },
  pt: { placeholder: 'Digite um valor', unit: 'Unidade', results: 'Convertido para', copy: 'Copiar', emptyHint: 'Digite um número acima para converter.' },
  ja: { placeholder: '値を入力', unit: '単位', results: '変換結果', copy: 'コピー', emptyHint: '上に数値を入力すると変換されます。' },
  de: { placeholder: 'Wert eingeben', unit: 'Einheit', results: 'Umgerechnet in', copy: 'Kopieren', emptyHint: 'Geben Sie oben eine Zahl ein, um umzurechnen.' },
};

// Default unit label = a language-neutral symbol (or romanization for traditional units). Traditional
// East-Asian units carry a value qualifier so they stay unambiguous in every locale (e.g. "cup (240 mL)").
const SYMBOL: Record<string, string> = {
  // length
  m: 'm', km: 'km', cm: 'cm', mm: 'mm', um: 'µm', nm: 'nm',
  mi: 'mi', yd: 'yd', ft: 'ft', in: 'in', nmi: 'nmi', shaku: 'shaku (30.3 cm)', sun: 'sun (3.03 cm)',
  // mass
  kg: 'kg', g: 'g', mg: 'mg', t: 't', lb: 'lb', oz: 'oz', st: 'st', ct: 'ct',
  don: 'don (3.75 g)', geun: 'geun (600 g)', geun_produce: 'geun (375 g)',
  kan: 'kan (3.75 kg)', monme: 'monme (3.75 g)', kin: 'kin (600 g)',
  // temperature
  c: '°C', f: '°F', k: 'K',
  // area
  m2: 'm²', km2: 'km²', cm2: 'cm²', mm2: 'mm²', ha: 'ha', mi2: 'mi²', acre: 'acre',
  ft2: 'ft²', in2: 'in²', yd2: 'yd²', pyeong: 'pyeong (3.31 m²)', jo: 'jō (1.65 m²)',
  // volume
  l: 'L', ml: 'mL', m3: 'm³', cm3: 'cm³', gal_us: 'gal (US)', gal_uk: 'gal (UK)',
  qt_us: 'qt (US)', pt_us: 'pt (US)', floz_us: 'fl oz (US)', tbsp_us: 'tbsp', tsp_us: 'tsp',
  cup_us: 'cup (240 mL)', cup_metric: 'cup (250 mL)', cup_jp: 'cup (200 mL)',
  sho: 'shō (1.8 L)', go: 'gō (180 mL)',
  // speed
  mps: 'm/s', kmh: 'km/h', mph: 'mph', knot: 'kn', fts: 'ft/s',
  // time
  ms: 'ms', s: 's', min: 'min', h: 'h', day: 'day', week: 'week',
  // digital
  bit: 'bit', byte: 'B', kb: 'KB', mb: 'MB', gb: 'GB', tb: 'TB', pb: 'PB',
  kib: 'KiB', mib: 'MiB', gib: 'GiB', tib: 'TiB',
};

// Locale overrides — only where a locale writes the unit differently (mostly traditional units and a
// couple of everyday words). Everything else falls back to SYMBOL.
const OVERRIDE: Partial<Record<Locale, Record<string, string>>> = {
  ko: {
    shaku: '자 (30.3 cm)', sun: '치 (3.03 cm)',
    don: '돈 (3.75 g)', geun: '근 (600 g)', geun_produce: '근 (채소·375 g)',
    pyeong: '평 (3.31 m²)',
    cup_us: '컵 (240 mL)', cup_metric: '컵 (250 mL)', cup_jp: '컵 (200 mL)',
  },
  ja: {
    shaku: '尺 (30.3 cm)', sun: '寸 (3.03 cm)',
    kan: '貫 (3.75 kg)', monme: '匁 (3.75 g)', kin: '斤 (600 g)',
    pyeong: '坪 (3.31 m²)', jo: '畳 (1.65 m²)',
    sho: '升 (1.8 L)', go: '合 (180 mL)',
    cup_us: 'カップ (240 mL)', cup_metric: 'カップ (250 mL)', cup_jp: 'カップ (200 mL)',
  },
};

/** Localized display label for a unit id. Falls back to a neutral symbol, then the raw id. */
export function unitLabel(unitId: string, locale: Locale): string {
  return OVERRIDE[locale]?.[unitId] ?? SYMBOL[unitId] ?? unitId;
}
