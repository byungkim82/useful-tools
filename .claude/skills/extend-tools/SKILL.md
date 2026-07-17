---
name: extend-tools
description: Add a new QR content type or a new language/locale to this useful-tools repo. Use when creating another QR generator variant (crypto/app-store/geo/paypal/… QR) or translating the whole site into another language. Covers the pure-payload-builder + qr-core pattern, the multi-locale i18n structural-identity + parallel-translation + merge workflow, and the build/verify/deploy checklist — including the `pnpm run deploy` gotcha, the ssr:false verification marker, and Cloudflare edge-cache propagation.
---

# Extend the tools suite

This repo is a $0-server, 100% client-side tool suite (Next.js static export → Cloudflare Workers Static
Assets). Today it hosts a **QR content-type suite**: N generators that all reuse one render engine and
differ only by input form + payload string, in M locales. Full architecture: `docs/qr-generator-implementation.md`.

**Two load-bearing invariants — violate either and the build breaks or the UI/SEO degrades:**
1. **`Dictionary` is the union of every locale JSON**, so `keyof Dictionary['tools']` = keys common to
   ALL locales. Every tool block must exist in **every** locale, structurally identical (same keys, same
   array lengths). Enforce with `scripts/check-i18n.mjs` (bundled).
2. **The tool DOM is `ssr:false`.** The real "is it kept out of static HTML" check is a DOM-only marker
   (`name="ec-level"`), NOT a dict prop string (props are serialized into the RSC flight payload → a
   false positive). See `ToolLoader.tsx` and rev-4 notes.

Deploy with **`pnpm run deploy`** — never `pnpm deploy` (pnpm's workspace builtin shadows the script and
fails with `ERR_PNPM_NOTHING_TO_DEPLOY`). Same for `pnpm run preview`.

---

## A. Add a QR content type

Pick an SEO slug (`<thing>-qr-code`, e.g. `crypto-qr-code`). Then:

1. **Payload builder (pure + tested)** — add to `src/tools/qr/content-payloads.ts`: a `build<Type>Payload()`
   returning the exact encoded string, plus a `type <Type>Input`. Watch encoding rules (URL-encode query
   params; escape in a single left-to-right regex pass so a literal backslash isn't double-escaped; end
   WiFi with `;;`; wrap events in `BEGIN:VCALENDAR…VEVENT…END`). Add cases to `content-payloads.test.ts`
   (happy path + escaping + optional-field omission). Run `pnpm test`.

2. **Client component** — `src/tools/qr/<Type>QrClient.tsx`, `'use client'`. Manage the form state,
   compute `text` (empty string until the input is valid → the empty hint shows), and render:
   ```tsx
   <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
     {/* the type-specific form inputs */}
   </QrCodeTool>
   ```
   `QrCodeTool` (in `qr-core.tsx`) owns EC/size/margin/colors, the debounced render, preview, warnings,
   and download/copy. `labels={t}` works because the dict slice is structurally assignable to `QrToolLabels`.

3. **Registry** — add an entry in `src/tools/registry.ts` with `group: 'qr'` (do NOT set `primary`; only
   the base `qr` tool is primary), an icon, ko+en `keywords`, and the `load` thunk.

4. **Type switcher label** — add one line to `LABEL` in `src/tools/qr/QrTypeNav.tsx` (short localized labels).

5. **Dictionary block in EVERY locale** — a `tools.<slug>` block per locale JSON with these keys:
   `title, description, metaTitle, metaDescription`, the form labels/placeholders, `emptyHint`,
   `previewAlt`, the **14 shared control labels** (`ecLevel, ecHint, size, margin, fgColor, bgColor,
   lowContrast, invertedColors, renderFailed, tooLong, downloadPng, downloadSvg, copyImage, copyFailed`),
   `howToTitle, howTo[3], featuresTitle, features[3], faqTitle, faq[5]`. **Copy the 14 shared labels
   verbatim from that locale's existing `wifi-qr-code` block** for consistency. → use the translation
   workflow in §C.

6. **Verify + deploy** — §D.

## B. Add a locale

1. `src/i18n/config.ts` — add the code to `locales` and a `localeMeta` entry (`lang`, `hreflang`,
   `ogLocale`, `label`; use a region for variants, e.g. `pt` → `lang:'pt-BR'`, `ogLocale:'pt_BR'`).
2. `src/i18n/dictionaries.ts` — add the `import('./dictionaries/<code>.json')` line.
3. Create `src/i18n/dictionaries/<code>.json` — a FULL translation of an existing locale, **structurally
   identical** (translate every tool + site/home/common). Use §C.
4. hreflang, `<html lang>`, OG locale, `LocaleSwitcher`, the branded 404 links, and the sitemap all
   update automatically from `locales`/`localeMeta`.
5. Verify + deploy — §D.

## C. Translate + merge (the i18n workflow)

Author the source blocks in **English (and Korean, the native-quality default)** yourself. For the other
locales, fan out translation to **parallel `general-purpose` subagents** (one per locale) — worked well
this session. Each subagent prompt must:
- Read the English source blocks + the target locale's existing JSON.
- Preserve structure PERFECTLY (same keys, same array lengths); translate only string VALUES.
- **Reuse the 14 shared control-label values verbatim** from the target locale's existing `wifi-qr-code`
  block (keeps the UI consistent).
- Keep tokens verbatim: `QR`, `SMSTO`, `mailto`, `wa.me`, `WhatsApp`, `vCard`, `geo`, `VEVENT`, `PNG`,
  `SVG`, example values, units.
- **Emit literal characters, never HTML entities** (`&`, not `&amp;` — the German agent got this wrong
  once; the entity renders literally on the page). `check-i18n.mjs` scans for this.
- For `metaTitle`/`metaDescription`, use natural high-volume search phrasing in that language.
- Output ONLY the JSON object; then (via a follow-up message) Write it to a file so you don't have to
  re-type it into your own context.

Then merge each into its locale JSON and check structure:
```bash
node .claude/skills/extend-tools/scripts/merge-tools.mjs es /path/new-tools-es.json   # per locale
node .claude/skills/extend-tools/scripts/check-i18n.mjs                                # MUST print ALL GOOD
```
(`merge-tools.mjs` re-serializes the file to uniform 2-space; that reformats existing inline `faq` arrays
to multi-line — cosmetic, expected.)

## D. Verify → deploy (verify, don't claim)

```bash
pnpm test && pnpm lint && pnpm build
node .claude/skills/extend-tools/scripts/check-i18n.mjs      # structural identity + no entities
```
Then inspect the built `out/`:
- new/changed `<title>` and `<meta name="description">` present (per locale);
- `application/ld+json` with `WebApplication` + `FAQPage`;
- **`name="ec-level"` ABSENT** from the tool page's static HTML (confirms ssr:false; a prop string is a
  false positive);
- home grid shows one card per group (`homeTools()`); each tool page has the `QrTypeNav` links;
- `sitemap.xml` URL count = locales × (1 + tools).

Deploy and live-verify:
```bash
pnpm run deploy                                             # NOT `pnpm deploy`
curl -s -o /dev/null -w '%{http_code}' https://tools.solisapps.com/<locale>/tools/<slug>/
```
Right after a deploy some edges briefly serve a **stale 404** for brand-new paths (Cloudflare cache
propagation). It self-heals via `max-age=0, must-revalidate` — re-check the canonical URL a few times;
don't panic. To confirm the client island actually mounts, screenshot or `--dump-dom` with headless
Chrome (`--headless=new --virtual-time-budget=6000`) and grep for a form field that is `ssr:false`
(so present only after JS runs).

Commit style: simple English, summary + bullet body, **no co-author trailer**, no branch prefix on `main`.
Docs are not served — don't deploy for doc-only changes.
