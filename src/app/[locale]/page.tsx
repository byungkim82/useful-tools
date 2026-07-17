import { getDictionary } from '@/i18n/dictionaries';
import { isLocale } from '@/i18n/config';
import { tools } from '@/tools/registry';
import ToolGrid from '@/components/ToolGrid';
import { notFound } from 'next/navigation';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return (
    <main>
      <h1 className="text-2xl font-bold">{dict.home.heading}</h1>
      <p className="mt-1 text-neutral-500">{dict.home.subheading}</p>
      <ToolGrid locale={locale} tools={tools} dict={dict} />
    </main>
  );
}
