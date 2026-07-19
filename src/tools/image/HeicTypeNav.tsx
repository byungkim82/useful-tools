import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { groupTools } from '@/tools/registry';
import { HEIC_NAV_LABEL } from './labels';
import { isHeicSlug } from './compress-math';

// In-tool output-format switcher for the HEIC group (heic-to-jpg ⇄ heic-to-webp). Mirrors ImageTypeNav.
// Labels come from HEIC_NAV_LABEL (code, not per-locale JSON). Server-rendered <a> links, so every HEIC
// page links to the other (crawlable, no JS needed).
export default function HeicTypeNav({ locale, current }: { locale: Locale; current: string }) {
  const items = groupTools('heic');
  const label = (slug: string) => (isHeicSlug(slug) ? HEIC_NAV_LABEL[slug][locale] : slug);
  return (
    <nav aria-label="HEIC tool" className="mt-4 flex flex-wrap gap-2">
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
