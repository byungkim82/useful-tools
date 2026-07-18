import '../globals.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { locales, isLocale, localeMeta, hreflangMap } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { SITE_ORIGIN, CF_BEACON_TOKEN } from '@/site';
import LocaleSwitcher from '@/components/LocaleSwitcher';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = await getDictionary(locale);
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: { default: dict.site.title, template: `%s · ${dict.site.title}` },
    description: dict.site.tagline,
    alternates: { canonical: `/${locale}/`, languages: hreflangMap((l) => `/${l}/`) },
    openGraph: {
      type: 'website', siteName: dict.site.title, title: dict.site.title, description: dict.site.tagline,
      url: `/${locale}/`, locale: localeMeta[locale].ogLocale,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeMeta[l].ogLocale),
      images: ['/og.png'],
    },
    twitter: { card: 'summary_large_image', images: ['/og.png'] },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return (
    <html lang={localeMeta[locale].lang}>
      <body className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={`/${locale}`} className="font-semibold">{dict.site.title}</Link>
          <LocaleSwitcher current={locale} />
        </header>
        <div className="mx-auto max-w-3xl px-4 pb-16">{children}</div>
        <footer className="mx-auto max-w-3xl px-4 py-8 text-sm text-neutral-500">{dict.site.tagline}</footer>
        {/* Cloudflare Web Analytics — cookieless, no personal tracking. Injected only when a token is set. */}
        {CF_BEACON_TOKEN ? (
          // `defer` is redundant on a type="module" script (modules defer by spec) but satisfies the
          // no-sync-scripts lint rule, which only looks for the async/defer attribute.
          <script
            type="module"
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
          />
        ) : null}
      </body>
    </html>
  );
}
