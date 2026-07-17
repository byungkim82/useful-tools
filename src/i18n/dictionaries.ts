import 'server-only';
import type { Locale } from './config';

const dictionaries = {
  ko: () => import('./dictionaries/ko.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
} as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

// Single source of truth for the dict SHAPE. `import type { Dictionary }` elsewhere is erased at
// compile time, so it does NOT drag `server-only` into client components.
export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
