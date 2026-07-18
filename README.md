# Useful Tools

Small, search-discovered, **100% client-side** browser tools with **no backend** ($0 server) and no
sign-up — nothing you type leaves your device. Live at **https://tools.solisapps.com**.

Two suites so far, each generator/converter sharing one engine with its own SEO landing page, in 6
languages: a **QR code suite** (9 generators) and a **unit converter suite** (8 categories, incl.
traditional Korean/Japanese units — 평/坪, 근, 돈).

| | |
|---|---|
| **QR** | URL/text · WiFi · vCard · email · SMS · phone · WhatsApp · location · event |
| **Converters** | length · weight · temperature · area · volume · speed · time · data |
| **Locales** | 한국어 · English · Español · Português (BR) · 日本語 · Deutsch (hreflang) |
| **Stack** | Next.js (App Router) · TypeScript · Tailwind v4 · `qrcode` · Vitest |
| **Hosting** | static export (`output: 'export'`) → Cloudflare Workers Static Assets |

## Develop

```bash
pnpm dev        # dev server (http://localhost:3000, redirects to /ko/)
pnpm test       # Vitest (pure payload/render logic)
pnpm lint       # ESLint
pnpm build      # static export → out/ (also writes a branded out/404.html)
pnpm run preview   # build + wrangler dev over ./out   ⚠️ NOT `pnpm preview`
pnpm run deploy    # build + wrangler deploy           ⚠️ NOT `pnpm deploy`
```

> **Gotcha:** this is a pnpm workspace, so bare `pnpm deploy` / `pnpm preview` resolve to pnpm's built-in
> commands (and fail). Always use `pnpm run deploy` / `pnpm run preview`.

## Add a tool

- **New QR content type:** a pure payload builder (+ test) in `src/tools/qr/content-payloads.ts`, a small
  client component feeding `QrCodeTool` (`src/tools/qr/qr-core.tsx`), a `registry.ts` entry with
  `group: 'qr'`, a label line in `QrTypeNav.tsx`, and a `tools.<slug>` block in **every** locale JSON.
- **New locale:** add it to `src/i18n/config.ts` (`locales` + `localeMeta`) and `dictionaries.ts`, then add
  a full translated `dictionaries/<locale>.json` — **structurally identical** to the others (the
  `Dictionary` type enforces it; `scripts`-style check compares all locale JSONs).

Home grid, routes, static params, hreflang, and the sitemap all follow automatically.

## Docs

- [`docs/qr-generator-implementation.md`](docs/qr-generator-implementation.md) — architecture, decisions,
  and verification log (source of truth = the code).
- [`docs/qr-generator-improvements.md`](docs/qr-generator-improvements.md) — feature / UX enhancement plan.
- [`docs/qr-generator-growth-seo.md`](docs/qr-generator-growth-seo.md) — search-discoverability strategy.
- [`docs/qr-generator-seo-action-checklist.md`](docs/qr-generator-seo-action-checklist.md) — SEO action items.
- [`docs/tool-roadmap.md`](docs/tool-roadmap.md) — next tools to add (6-locale research → ranked, consumer-first backlog).
- [`docs/unit-converter-research.md`](docs/unit-converter-research.md) — research feeding the first non-QR tool (features, demand, per-locale units, UI/UX).
- [`docs/monetization-strategy.md`](docs/monetization-strategy.md) — turning multilingual traffic into revenue (short/mid/long term + AI tier).

See also `AGENTS.md` — this repo pins a Next.js whose APIs may differ from training data; read the guides
in `node_modules/next/dist/docs/` before writing framework code.
