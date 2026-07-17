// Day-1 SEO decision. Set once; layout/sitemap/robots all read it.
export const SITE_ORIGIN = 'https://tools.solisapps.com';

// Cloudflare Web Analytics beacon token — the value from the dashboard's
// `data-cf-beacon` snippet (Web Analytics → Manage site). It is public (it ships
// in the delivered HTML), so it lives in source, not a secret. An empty string
// injects nothing, so the site builds cleanly before a token exists.
export const CF_BEACON_TOKEN = '45f4dec5305442108923e25a034273aa';
