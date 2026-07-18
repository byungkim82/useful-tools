import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale, localeMeta, hreflangMap } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { getDictionary } from '@/i18n/dictionaries';
import { tools, getTool } from '@/tools/registry';
import ToolLoader from '@/tools/ToolLoader';
import QrTypeNav from '@/tools/qr/QrTypeNav';
import ConverterTypeNav from '@/tools/convert/ConverterTypeNav';
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
    // `absolute` skips the parent "%s · <site>" template so the keyword-tuned title isn't padded past
    // the SERP truncation length. H1 keeps the short `t.title`.
    title: { absolute: t.metaTitle },
    description: t.metaDescription,
    alternates: {
      canonical: `/${locale}/tools/${slug}/`,
      languages: hreflangMap((l) => `/${l}/tools/${slug}/`),
    },
    // Re-declare type/siteName/locale — Next REPLACES the whole openGraph object on override.
    openGraph: {
      type: 'website', siteName: dict.site.title, locale: localeMeta[locale].ogLocale,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeMeta[l].ogLocale),
      title: t.title, description: t.metaDescription, url: `${SITE_ORIGIN}/${locale}/tools/${slug}/`, images: ['/og.png'],
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !getTool(slug)) notFound();
  const dict = await getDictionary(locale);
  // Single legitimate cast: `slug` is a raw URL param (string), validated by getTool() above.
  const key = slug as keyof Dictionary['tools'];
  const t = dict.tools[key];
  const group = getTool(slug)?.group;
  const url = `${SITE_ORIGIN}/${locale}/tools/${slug}/`;
  // Crawlable structured data. The tool DOM is ssr:false, so without this the static HTML is thin.
  // FAQPage mirrors the visible FAQ below (Google requires the Q&A to be on-page).
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: t.title, description: t.metaDescription, url,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: t.faq.map((f) => ({
        '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];
  return (
    <main>
      {/* JSON-LD escapes `<` so page content can never break out of the script tag. */}
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="mt-1 text-neutral-500">{t.description}</p>
      {group === 'qr' && <QrTypeNav locale={locale} current={slug} group={group} />}
      {group === 'converter' && <ConverterTypeNav locale={locale} current={slug} />}
      <div className="mt-6">
        <ToolLoader slug={slug} t={t} common={dict.common} locale={locale} />
      </div>

      {/* Static, crawlable copy: gives Google real text to rank on and feeds the FAQ schema above. */}
      <section className="mt-12 space-y-8 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold">{t.howToTitle}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-600 dark:text-neutral-400">
            {t.howTo.map((step, i) => <li key={i}>{step}</li>)}
          </ol>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t.featuresTitle}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-600 dark:text-neutral-400">
            {t.features.map((feat, i) => <li key={i}>{feat}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{t.faqTitle}</h2>
          <dl className="mt-2 space-y-3">
            {t.faq.map((f, i) => (
              <div key={i}>
                <dt className="font-medium text-neutral-800 dark:text-neutral-200">{f.q}</dt>
                <dd className="mt-1 text-neutral-600 dark:text-neutral-400">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
