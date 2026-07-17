# `useful-tools` — QR Generator (v1) + Static Tool-Suite Scaffold

> **Rev 5 — QR SUITE, LIVE.** No longer a spec; the code is in the repo, deployed at
> **https://tools.solisapps.com**, and is the source of truth. The first tool grew into a QR
> **content-type suite**: 9 generators (URL/text · WiFi · vCard · email · SMS · phone · WhatsApp ·
> location · event) across **6 locales** (ko · en · es · pt-BR · ja · de), all sharing one render engine.
> This document records the architecture, the hard-won decisions, and the verification log. Build:
> `pnpm build` · test: `pnpm test` · preview: `pnpm run preview` · deploy: **`pnpm run deploy`** (NOT
> `pnpm deploy` — pnpm's workspace builtin shadows the script). See CHANGELOG rev 5 for the deltas.

---

## 1. Goal

A suite of small, search-discovered, 100% client-side browser tools ($0 server). The reusable scaffold
(tool registry, i18n, home grid, `/tools/[slug]`, sitemap/robots, branded 404, Cloudflare deploy) now
hosts a **QR content-type suite**: 9 generators that all reuse one render core (`qr-core.tsx`) and differ
only by their input form + payload builder (`content-payloads.ts`, pure + unit-tested). Every type is its
own SEO landing page (`/tools/wifi-qr-code/` …); the home grid shows one grouped card and each tool page
carries a localized type switcher (`QrTypeNav`).

Adding a QR content type: a pure payload builder (+ test), a small client feeding `QrCodeTool`, a
`registry.ts` entry (`group:'qr'`), a `QrTypeNav` label line, and a `tools.<slug>` block in **every**
locale JSON. Adding a locale: a `config.ts` entry (+ `localeMeta`), a `dictionaries.ts` import, and a full
translated JSON (structurally identical to the rest). Grid, routes, static params, hreflang, and sitemap
follow automatically.

## 2. Stack

Next.js **16.2.10** (pinned exact) · App Router · TS · Tailwind v4 · **static export** (`output:'export'`)
→ **Cloudflare Workers Static Assets** · root `/` via a **`_redirects`** edge rule · dependency-free
dictionary i18n · `qrcode` (node-qrcode) · Vitest.

## 3. File map (source of truth = the code)

```
public/_redirects            "/  /ko/  302"  (edge root redirect)
public/og.png                1200×630 OG image (shipped; embeds a scannable QR of the site)
public/google*.html          Google Search Console HTML-file verification token
scripts/build-404.mjs        post-build: overwrites out/404.html with a branded KO page
src/site.ts                  SITE_ORIGIN (single domain source)
next.config.ts               output:'export', images.unoptimized, trailingSlash
wrangler.jsonc               assets ./out, not_found_handling "404-page"
src/i18n/                    config.ts (locales + localeMeta + hreflangMap) · dictionaries.ts · dictionaries/{ko,en,es,pt,ja,de}.json
src/app/[locale]/            layout.tsx (SOLE root layout, <html lang>, OG) · page.tsx (grid) · tools/[slug]/page.tsx
src/app/{sitemap,robots}.ts  both export `dynamic = 'force-static'`
src/components/              ToolGrid.tsx · LocaleSwitcher.tsx
src/tools/                   registry.ts (mapped type) · ToolLoader.tsx (dynamic ssr:false + context spinner)
src/tools/qr/                qr-payload.ts + qr-core.tsx (shared render engine) · content-payloads.ts (+ tests) · QrTypeNav.tsx · 9 *QrClient.tsx (one per type)
```
There is **no `src/app/layout.tsx`** — `[locale]/layout.tsx` is the sole root layout, so `<html lang>`
is baked per locale. `/` has no Next page; the edge `_redirects` rule serves it.

## 4. Decisions that were hard-won (and the ones I got wrong first)

- **`sitemap.ts` / `robots.ts` need `export const dynamic = 'force-static'`** under `output:'export'`,
  or the build fails (`Failed to collect page data for /sitemap.xml`). Not optional.
- **`ToolMeta` is a distributive mapped type**, not `ComponentType<union-props>`. A union-props
  loader compiles at N=1 by accident and breaks **every** tool at N=2 (props contravariance). The
  mapped type correlates each `slug` with its own dict slice; a mis-wired `load` is a compile error.
  One documented cast lives in `ToolLoader` at the dynamic-dispatch boundary.
- **`next/dynamic({ssr:false})` DOES keep the tool's DOM out of the static HTML — but only when called
  at module scope** (statically analyzable). Verified by checking a DOM-only marker (`name="ec-level"`),
  NOT a `dict` prop string (props are serialized into the RSC flight payload regardless — grepping one
  is a false positive). A `useRef`/`useMemo`-created dynamic trips `react-hooks/refs`/remount rules;
  `lazy()`+`Suspense` SSRs the tool INTO the HTML. So: module-scope `dynamic`, and the localized
  loading label reaches the module-scope spinner via **React Context** (`ToolLoader.tsx`).
- **Branded 404.** `out/404.html` is one file needing a root layout; generating a branded one via
  `app/not-found.tsx` would force an `app/layout.tsx` and lose per-locale `<html lang>` on content
  pages. Resolution: a post-build step (`scripts/build-404.mjs`) overwrites `out/404.html` with a
  branded KO page (links to `/ko/` + `/en/`, `noindex`). CF serves it on every unmatched path —
  verified. Per-locale content lang is preserved.
- **Root redirect via `_redirects`, no persistence.** CF `_redirects` can't branch by language, so
  `/` → `/ko/` always; English visitors click EN once (hreflang carries SEO). An earlier
  `LocalePreference` (localStorage auto-redirect) was dropped: it double-loaded for returning users
  and bounced the language on the first home click.
- **Trailing slash everywhere.** `trailingSlash:true` ⇒ every canonical/sitemap/hreflang URL ends in
  `/`, or CF 307s. `<Link>` internal hrefs get the slash added automatically (verified — no 307 chain).
- **a11y: prefer native semantics.** EC selector is real `<input type="radio">` styled as buttons
  (arrow keys / focus / form semantics for free) — a fake `role="radiogroup"` without key handlers is
  worse than a plain button. Copy button keeps a **stable** name; success is announced by a separate
  `aria-live` region (a changing `aria-label` would hide the state or double-announce). Spinner is
  `role="status"` with an `sr-only` localized label (not `aria-hidden`, which would silence it).
- **No `lastModified` in the sitemap** — a single build-time timestamp on every URL is a false
  "everything changed" signal; omission is more honest.

## 5. Verification — ACTUAL log (this repo, Next 16.2.10)

```
pnpm lint     → clean (0 problems)
pnpm test     → Test Files 1 passed (1) · Tests 5 passed (5)   # capacity test throws a REAL qrcode error
pnpm build    → ✓ Compiled · TS passed · 9 tools × 6 locales = 54 tool pages + 6 homes · sitemap 60 URLs · branded 404
              (rev-4 details below are the ko/en baseline; rev 5 adds es/pt/ja/de + 8 content types — see CHANGELOG)

out/  → ko/index.html, en/index.html, ko|en/tools/qr/index.html, sitemap.xml, robots.txt,
        404.html, _redirects ALL present · NO out/index.html
<html lang> → ko="ko", en="en", 404="ko"
tool DOM (name="ec-level", <textarea>) → ABSENT from static HTML (ssr:false works)
spinner label SSR'd → ko "불러오는 중", en "Loading"  (Context-localized)
no English leak in out/ko
tool-page OG → og:type + og:site_name + og:locale present
sitemap → trailing-slash <loc> + xhtml:link hreflang · NO <lastmod>

N=2 (add a 'compress' tool): build OK, 4 tool routes; mis-wiring load→wrong component = TS2322 (qr stays clean)

# runtime — wrangler dev over ./out
/                → 302 → /ko/          (edge _redirects)
/ko              → 307 → /ko/          (trailing slash)
/ko/ , /ko/tools/qr/ → 200
/nope/           → 404 + branded body "페이지를 찾을 수 없습니다"
/_redirects      → 404 (not exposed)
```

**Still manual (browser only):** live debounced preview, size slider CSS-scaling the preview, EC toggle,
PNG/SVG download, iOS-Safari clipboard copy. Run `pnpm dev` or `pnpm preview` and exercise `/ko/tools/qr`.

## 6. Launch status (done — see rev 5)

- ✅ Real domain in `src/site.ts` (`https://tools.solisapps.com`); site is **live** on Cloudflare.
- ✅ Real `public/og.png` (1200×630) shipped; social/link previews render. (A static PNG is used; the
  dynamic `opengraph-image.tsx` / `ImageResponse` route was never needed.)
- ✅ Deployed via `pnpm run deploy` (wrangler authenticated). Pure static: no Worker invocation billed.
- ✅ Google Search Console verified (HTML-file token) + sitemap submitted + indexing requested. Naver
  Search Advisor deferred (no account). Still open: native review of the translations; distribution.
- Future dynamic tool (URL shortener / FX): add `"main"` + `assets.binding:"ASSETS"` to `wrangler.jsonc`;
  the Worker handles `/api/*` and falls through to `env.ASSETS.fetch(request)`.

## 7. Gotchas

No `src/app/layout.tsx` (sole root is `[locale]/layout.tsx`) · no `/` page (edge `_redirects`) ·
`force-static` on sitemap/robots · module-scope `dynamic({ssr:false})` only · `images.unoptimized:true` ·
trailing-slash URLs · ko/en dicts structurally identical, every tool block has `{title,description}` ·
Next 16 async `params` (await everywhere) · Safari clipboard = Promise into `ClipboardItem`, no pre-await ·
`out/404.html` is regenerated by `scripts/build-404.mjs` on every build (chained in the `build` script).

## CHANGELOG (3 review rounds)

- **rev 1 → 2:** `plans/`→`docs/`; Next pinned; `_redirects` edge redirect (dropped `(root)` group +
  client redirect); debounce fix; capacity-error wiring; size-preview; Safari clipboard; trailing-slash
  SEO; robots/OG; single registry via `load` thunk; `slug: keyof Dictionary['tools']`; typed dict slice;
  `common` reaches tools; localized loading/alt. *(§16 claimed "verified" but wasn't.)*
- **rev 2 → 3:** `force-static` on sitemap/robots (build blocker); **distributive mapped `ToolMeta`**
  (union broke at N=2); removed copy `aria-label`; **real** capacity test; generic-error state; dropped
  `LocalePreference`; contrast **polarity** check; tool-page OG type/siteName/locale; exact pin; EC
  `role=radiogroup`; §14 became a real build log. *(§14 held up under the reviewer's rebuild.)*
- **rev 3 → 4 (implemented):** branded `out/404.html` via `scripts/build-404.mjs` (404 was an unbranded
  English dead-end); **native `<input type=radio>`** for EC (fake radiogroup had no keyboard handlers —
  worse than plain buttons); Context-localized spinner (fixed `aria-hidden`-silenced spinner + revived
  the dead `common.loading`); removed dead `common.download`/`common.copy`; single copy announcement via
  `aria-live` (stable button name); `result`-object effect (no synchronous `setState` in effect body);
  removed sitemap `lastModified`; corrected the `ssr:false` understanding (verified via DOM marker, not a
  serialized prop). Everything lint/test/build/runtime-verified in-repo.
- **rev 4 → 5 (QR suite, live):** extracted the render engine into **`qr-core.tsx`** (`QrCodeTool` owns
  options/debounce/preview/download; each tool passes a payload string + its input form) — the URL tool
  was refactored onto it with no behavior change (ec-level DOM marker still absent from static HTML).
  Added **8 content types** (WiFi, vCard, email, SMS, phone, WhatsApp, location, event) as pure
  unit-tested builders in `content-payloads.ts` (WiFi escaping order, vCard/VEVENT envelopes,
  datetime→iCal) + one client each; every type is its own SEO landing page. Added **4 locales**
  (es, pt-BR, ja, de); generalized hreflang / `<html lang>` / OG-locale off a `localeMeta` map +
  `hreflangMap()`; all 6 locale JSONs are structurally identical (enforced by the `Dictionary` union +
  a check script). On-page SEO on every tool page: keyword `metaTitle`/`metaDescription`
  (`title:{absolute}`), crawlable how-to/features/FAQ copy, and `WebApplication`+`FAQPage` JSON-LD. Home
  grid shows **one grouped card** (`group`/`primary` on registry, `homeTools()`); each tool page has a
  localized **`QrTypeNav`** switcher (server links → internal linking preserved). Shipped `og.png` (real,
  embeds a scannable QR) + GSC verification file. Now **9 tools × 6 locales = 54 tool pages, sitemap 60
  URLs**, deployed live. Gotcha recorded: deploy with **`pnpm run deploy`**, not `pnpm deploy`
  (workspace builtin shadows the script).
```
