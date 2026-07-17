import type { MetadataRoute } from 'next';
import { locales, hreflangMap } from '@/i18n/config';
import { tools } from '@/tools/registry';
import { SITE_ORIGIN } from '@/site';

export const dynamic = 'force-static'; // REQUIRED under output:'export' or the build fails.

// No lastModified: a single build-time timestamp on every URL tells Google "everything changed on
// every deploy," which is a false signal. Omitting it is more honest than a shared fake date.
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    entries.push({
      url: `${SITE_ORIGIN}/${locale}/`, changeFrequency: 'weekly', priority: 1,
      alternates: { languages: hreflangMap((l) => `${SITE_ORIGIN}/${l}/`, false) },
    });
    for (const t of tools) {
      entries.push({
        url: `${SITE_ORIGIN}/${locale}/tools/${t.slug}/`, changeFrequency: 'monthly', priority: 0.8,
        alternates: { languages: hreflangMap((l) => `${SITE_ORIGIN}/${l}/tools/${t.slug}/`, false) },
      });
    }
  }
  return entries;
}
