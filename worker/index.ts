// Root language router — the ONE piece of server-side logic in an otherwise 100% static site.
//
// WHY THIS EXISTS: `/` has no page (the app is `[locale]`-only, so there is no out/index.html). It used
// to be a blind `/  /ko/  302` rule in public/_redirects — everyone landed on Korean. This Worker instead
// reads Accept-Language at the edge and sends each visitor to their best-matching locale, falling back to
// `xDefaultLocale` (English) so it stays consistent with the hreflang x-default we advertise to search
// engines (see src/i18n/config.ts — the site default is `ko`, but the search-surface default is `en`).
//
// ROUTING: wrangler runs this Worker first ONLY for "/" (assets.run_worker_first: ["/"] in wrangler.jsonc).
// Every real page (/ko/, /ko/qr/, ...) matches a static asset and is served directly by the asset layer
// with its _headers rules — this Worker is never invoked for them. Any other unmatched path that does fall
// through to the Worker is delegated straight back to the asset layer via env.ASSETS.fetch, which applies
// not_found_handling ("404-page"). Locale list and matching come from the same config the pages use, so
// there is no drift.
import { xDefaultLocale, isLocale, type Locale } from '../src/i18n/config';

// Pick the highest-priority Accept-Language entry whose primary subtag is one of our locales.
// e.g. "de-DE,de;q=0.9,en;q=0.8" -> "de"; "pt-BR" -> "pt"; "fr" or "*" or missing -> null (caller defaults).
function pickLocale(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/^q=(\d+(?:\.\d+)?)$/);
        if (m) q = parseFloat(m[1]);
      }
      return { primary: tag.trim().toLowerCase().split('-')[0], q };
    })
    .filter((x) => x.primary && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { primary } of ranked) {
    if (isLocale(primary)) return primary;
  }
  return null;
}

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      const locale = pickLocale(request.headers.get('accept-language')) ?? xDefaultLocale;
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/${locale}/`,
          // Response varies per visitor, so it must never be cached and served to someone else.
          'Cache-Control': 'no-store',
          Vary: 'Accept-Language',
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};

export default handler;
