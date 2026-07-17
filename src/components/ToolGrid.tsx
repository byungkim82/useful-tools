import Link from 'next/link';
import type { ToolMeta } from '@/tools/registry';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export default function ToolGrid({ locale, tools, dict }: { locale: Locale; tools: ToolMeta[]; dict: Dictionary }) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {tools.map((t) => {
        const meta = dict.tools[t.slug]; // fully typed — t.slug is keyof Dictionary['tools']
        return (
          <li key={t.slug}>
            <Link href={`/${locale}/tools/${t.slug}`} data-keywords={t.keywords.join(' ')}
                  className="block rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{t.icon}</span>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {dict.categories[t.category]}
                </span>
              </div>
              <div className="mt-2 font-semibold">{meta.title}</div>
              <div className="mt-1 text-sm text-neutral-500">{meta.description}</div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
