import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { groupTools } from '@/tools/registry';
import { NAV_LABEL } from './labels';
import { isImageSlug } from './compress-math';

// In-tool format switcher for the image group — mirrors ConverterTypeNav / QrTypeNav. Labels come from
// NAV_LABEL (code, not per-locale JSON). Server-rendered <a> links, so every image page links to the
// others (crawlable, no JS needed).
export default function ImageTypeNav({ locale, current }: { locale: Locale; current: string }) {
  const items = groupTools('image');
  const label = (slug: string) => (isImageSlug(slug) ? NAV_LABEL[slug][locale] : slug);
  return (
    <nav aria-label="Image tool" className="mt-4 flex flex-wrap gap-2">
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
