import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/site';

export const dynamic = 'force-static'; // REQUIRED under output:'export' or the build fails.

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE_ORIGIN}/sitemap.xml` };
}
