import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { getDictionary } from '@/i18n/dictionaries';
import { tools, getTool } from '@/tools/registry';
import ToolLoader from '@/tools/ToolLoader';
import { SITE_ORIGIN } from '@/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => tools.map((t) => ({ locale, slug: t.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !getTool(slug)) return {};
  const dict = await getDictionary(locale);
  const t = dict.tools[slug as keyof Dictionary['tools']];
  return {
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `/${locale}/tools/${slug}/`,
      languages: { ko: `/ko/tools/${slug}/`, en: `/en/tools/${slug}/`, 'x-default': `/ko/tools/${slug}/` },
    },
    // Re-declare type/siteName/locale — Next REPLACES the whole openGraph object on override.
    openGraph: {
      type: 'website', siteName: dict.site.title, locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      title: t.title, description: t.description, url: `${SITE_ORIGIN}/${locale}/tools/${slug}/`, images: ['/og.png'],
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !getTool(slug)) notFound();
  const dict = await getDictionary(locale);
  // Single legitimate cast: `slug` is a raw URL param (string), validated by getTool() above.
  const key = slug as keyof Dictionary['tools'];
  return (
    <main>
      <h1 className="text-2xl font-bold">{dict.tools[key].title}</h1>
      <p className="mt-1 text-neutral-500">{dict.tools[key].description}</p>
      <div className="mt-6">
        <ToolLoader slug={slug} t={dict.tools[key]} common={dict.common} locale={locale} />
      </div>
    </main>
  );
}
