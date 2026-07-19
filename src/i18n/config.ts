export const locales = ['ko', 'en', 'es', 'pt', 'ja', 'de'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Per-locale presentation metadata: <html lang>, hreflang code, OG locale, and switcher label.
// `pt` is Brazilian Portuguese, so its lang/hreflang/OG carry the -BR/_BR region.
export const localeMeta: Record<Locale, { lang: string; hreflang: string; ogLocale: string; label: string }> = {
  ko: { lang: 'ko', hreflang: 'ko', ogLocale: 'ko_KR', label: '한국어' },
  en: { lang: 'en', hreflang: 'en', ogLocale: 'en_US', label: 'English' },
  es: { lang: 'es', hreflang: 'es', ogLocale: 'es_ES', label: 'Español' },
  pt: { lang: 'pt-BR', hreflang: 'pt-BR', ogLocale: 'pt_BR', label: 'Português' },
  ja: { lang: 'ja', hreflang: 'ja', ogLocale: 'ja_JP', label: '日本語' },
  de: { lang: 'de', hreflang: 'de', ogLocale: 'de_DE', label: 'Deutsch' },
};

// The locale Google serves to visitors whose language matches none of ours. English, NOT
// `defaultLocale` — ko is the site's default, but a French or Hindi searcher landing on Korean
// copy bounces. This is a search-surface decision, so it is deliberately separate from the
// site-default decision above.
export const xDefaultLocale: Locale = 'en';

// hreflang → URL map for <link rel=alternate> and the sitemap. `path(l)` returns the URL for locale l.
export function hreflangMap(path: (l: Locale) => string, xDefault = true): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of locales) map[localeMeta[l].hreflang] = path(l);
  if (xDefault) map['x-default'] = path(xDefaultLocale);
  return map;
}
