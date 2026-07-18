import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { groupTools } from '@/tools/registry';
import { CATEGORY_LABEL, categoryOfSlug } from './labels';

// In-tool category switcher for the converter suite — mirrors QrTypeNav. Labels come from CATEGORY_LABEL
// (code, not per-locale JSON). Server-rendered <a> links, so every converter page links to every other.
export default function ConverterTypeNav({ locale, current }: { locale: Locale; current: string }) {
  const items = groupTools('converter');
  const label = (slug: string) => {
    const cat = categoryOfSlug(slug);
    return cat ? CATEGORY_LABEL[cat][locale] : slug;
  };
  return (
    <nav aria-label="Converter category" className="mt-4 flex flex-wrap gap-2">
      {items.map((t) =>
        t.slug === current ? (
          <span
            key={t.slug}
            aria-current="page"
            className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {label(t.slug)}
          </span>
        ) : (
          <Link
            key={t.slug}
            href={`/${locale}/tools/${t.slug}`}
            className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {label(t.slug)}
          </Link>
        ),
      )}
    </nav>
  );
}
