# Implementation Spec: `useful-tools` — QR Generator (v1) + Static Tool-Suite Scaffold

> **How to use this document.** Self-contained build spec — follow the sections in order. Every file
> that needs writing has its full content below. Target: Next.js 16 App Router, TypeScript, Tailwind
> v4, **static export**, deployed to **Cloudflare Workers Static Assets**, ko/en i18n, QR generator first.
>
> **Rev 3 — this entire spec was scaffolded and built end-to-end before writing (Next 16.2.10, pnpm 10).**
> §14 is the actual build/test log, not a list of claims. Changes vs rev 2 in the CHANGELOG at the bottom.

---

## 1. Context & Goal

A suite of small, search-discovered browser utilities ("한 번쯤 검색해서 찾게 되는 도구").
Core value prop: **100% client-side, $0 server cost**. This milestone builds the reusable scaffold
(tool registry, i18n, home grid, `/tools/[slug]` route, sitemap/robots, Cloudflare deploy) and ships
the **first tool: a QR code generator**.

**Adding tool N is exactly 3 edits — verified by building at N=2 (§14):** (1) one `registry.ts`
entry with its `load` thunk, (2) one dictionary block in `ko.json`/`en.json`, (3) one client
component. Home grid, `/tools/[slug]` route, static params, and sitemap follow automatically. No
`ToolLoader` edit — it reads the registry.

**QR v1 scope (Basic+):** text/URL input, live preview (text debounced, options immediate), EC level
(L/M/Q/H), size, margin, fg/bg color, download PNG + SVG, copy-to-clipboard, contrast/polarity warning.

---

## 2. Tech Stack & Verification Status

| Concern | Choice |
|---|---|
| Framework | **Next.js 16.2.10** (App Router, TS, `src/`, `@/*` → `src/*`) — **pinned exact** |
| React | 19 |
| Styling | Tailwind CSS v4 (CSS-first, `@tailwindcss/postcss`, no `tailwind.config.js`) |
| Hosting | Next.js **static export** (`output:'export'`) → **Cloudflare Workers Static Assets** |
| Root redirect | Cloudflare **`_redirects`** edge rule (`/` → `/ko/`) — no JS, no Worker invocation |
| i18n | **Dependency-free** dictionaries + `[locale]` segment (ko default, en). No next-intl, no persistence. |
| QR lib | `qrcode` (node-qrcode) — `toDataURL` (PNG) + `toString({type:'svg'})` |
| Tests | Vitest — the capacity test calls the REAL qrcode error path |
| Package manager | pnpm 10 (Node 22, wrangler 4.54) |

**Verification status — built, not claimed (see §14 for the log):**
- ✅ `pnpm build` (static export) succeeds; TypeScript passes; 9 routes prerender.
- ✅ `robots.txt` + `sitemap.xml` emit **only** with `export const dynamic = 'force-static'` (without it,
  the build fails — this was a rev-2 blocker).
- ✅ Registry mapped type compiles at **N=2** (two tools) and still **catches a mis-wired component**.
- ✅ `out/{ko,en}/…`, `sitemap.xml`, `robots.txt`, `404.html`, `_redirects` present; **no** `out/index.html`;
  `<html lang>` correct per locale; no English strings leak into ko output.
- ✅ Tool-page OG carries `type`/`site_name`/`locale`; sitemap URLs are trailing-slash with hreflang alternates.
- ⚠️ **Known minor gap:** `out/404.html` has **no `<html lang>`** (there is no top-level root layout to set it).
  Documented in §17; not worth a synthetic root layout.
- ❓ **Not verified:** dynamic OG image (`opengraph-image.tsx` via `ImageResponse`) under `output:'export'`
  → this spec uses a **static** `public/og.png`. Runtime behavior (browser Clipboard/scan) is manual (§14.5).

---

## 3. Prerequisites & Setup

`docs/` is on create-next-app's allowlist, so this spec lives in `docs/` and scaffolding still
succeeds. (`plans/` and `.github/` are **not** allowlisted — add CI under `.github/` only after scaffolding.)

```bash
cd /Users/byungkim/ClaudeProjects/useful-tools

# 1. Scaffold, pinned to Next 16. All flags → non-interactive. Next 16 defaults to Turbopack (dev + build).
pnpm dlx create-next-app@16 . --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-pnpm

# 2. Pin next EXACTLY (plain `next@16` writes a caret range; --save-exact writes "16.2.10").
pnpm add next@16.2.10 --save-exact

# 3. Runtime + tooling
pnpm add qrcode server-only
pnpm add -D @types/qrcode vitest

# 4. Tailwind v4 (create-next-app@16 already adds these; verify the set)
pnpm add -D tailwindcss @tailwindcss/postcss postcss

# 5. git
git init
```

After scaffolding, **delete the defaults our structure replaces:**
- `src/app/layout.tsx`  ← DELETE (sole root layout becomes `src/app/[locale]/layout.tsx`)
- `src/app/page.tsx`    ← DELETE (there is no `/` page — the edge `_redirects` rule owns `/`)

> If you skip these deletes, `tsc --noEmit` will complain about stale `.next/types` referencing the old
> `layout.js`/`page.js` until the next `next build` regenerates types. `next build` is the authoritative check.

---

## 4. Final Directory Structure

```
useful-tools/
├── next.config.ts · postcss.config.mjs · wrangler.jsonc · tsconfig.json · package.json · vitest.config.ts
├── docs/qr-generator-implementation.md          # this document
├── public/
│   ├── _redirects                               # "/  /ko/  302"
│   └── og.png                                   # static Open Graph image (1200×630)
└── src/
    ├── site.ts                                  # SITE_ORIGIN — single domain source
    ├── app/
    │   ├── globals.css · robots.ts · sitemap.ts
    │   └── [locale]/                            # SOLE root layout — NO src/app/layout.tsx
    │       ├── layout.tsx · page.tsx
    │       └── tools/[slug]/page.tsx
    ├── components/ToolGrid.tsx · LocaleSwitcher.tsx
    ├── i18n/config.ts · dictionaries.ts · dictionaries/{ko,en}.json
    └── tools/
        ├── registry.ts · ToolLoader.tsx
        └── qr/qr-payload.ts · qr-payload.test.ts · QrToolClient.tsx
```

> **Structural rule:** NO `src/app/layout.tsx`. `[locale]/layout.tsx` is the sole root layout (renders
> `<html lang={locale}><body>`), like Next's official i18n example. `/` has no Next page — the CF
> `_redirects` rule serves it at the edge. (`LocalePreference` from rev 2 was removed — see §5/CHANGELOG.)

---

## 5. Config Files

### `src/site.ts`
```ts
// Day-1 SEO decision. Set once; layout/sitemap/robots all read it.
export const SITE_ORIGIN = 'https://useful-tools.example';
```

### `next.config.ts`
```ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
};
export default nextConfig;
```
Unsupported under `output:'export'` (fail the build): `redirect()`, `rewrites()`, `headers()`, server
actions, ISR, `next/image` optimization. **Route handlers ARE allowed only if static** — hence the
`force-static` export required on `sitemap.ts`/`robots.ts` (§11).

### `postcss.config.mjs`
```js
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;
```

### `src/app/globals.css`
```css
@import "tailwindcss";

@layer components {
  .btn-primary { @apply rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:pointer-events-none dark:bg-white dark:text-neutral-900; }
  .btn-secondary { @apply rounded border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none dark:border-neutral-700; }
}
```

### `public/_redirects`
```
/  /ko/  302
```
Native to Workers Static Assets (no Worker invocation). **Tradeoff (documented, accepted):** CF
`_redirects` cannot branch by `Accept-Language`, so every root hit goes to `/ko/` — an English visitor
lands on Korean and clicks **EN** once. **There is no locale persistence** (rev 2's `LocalePreference`
was removed: it caused a double page-load for returning users and bounced the language on the first
home click). This is acceptable because Google recommends hreflang over auto language-redirects, and
search traffic lands on localized deep links (`/ko/tools/qr/`, `/en/tools/qr/`) directly via hreflang.

### `wrangler.jsonc`
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "useful-tools",
  "compatibility_date": "2026-07-15",
  "assets": { "directory": "./out", "not_found_handling": "404-page" }
  // Future dynamic tool: add "main":"src/worker/index.ts" and, inside "assets", "binding":"ASSETS".
}
```

### `package.json` (scripts + exact pin)
```jsonc
{
  "dependencies": { "next": "16.2.10" },       // EXACT — do not float to @latest
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "preview": "next build && wrangler dev",
    "deploy": "next build && wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
```

---

## 6. i18n Layer

### `src/i18n/config.ts`
```ts
export const locales = ['ko', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
```

### `src/i18n/dictionaries.ts`
```ts
import 'server-only';
import type { Locale } from './config';
const dictionaries = {
  ko: () => import('./dictionaries/ko.json').then((m) => m.default),
  en: () => import('./dictionaries/en.json').then((m) => m.default),
} as const;
export function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
// Single source of truth for the dict SHAPE. `import type { Dictionary }` elsewhere is erased at
// compile time, so it does NOT drag `server-only` into client components (that's why registry.ts uses it).
export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
```

### `src/i18n/dictionaries/ko.json`
```json
{
  "site": { "title": "유용한 도구 모음", "tagline": "브라우저에서 바로 쓰는 무료 도구. 파일이 서버로 업로드되지 않습니다." },
  "home": { "heading": "도구 모음", "subheading": "필요한 도구를 골라 바로 사용하세요." },
  "categories": { "generator": "생성기" },
  "common": { "download": "다운로드", "copy": "복사", "copied": "복사됨", "loading": "불러오는 중" },
  "tools": {
    "qr": {
      "title": "QR 코드 생성기",
      "description": "링크·텍스트를 QR 코드로 즉시 변환하고 PNG·SVG로 저장하세요.",
      "inputLabel": "URL 또는 텍스트",
      "inputPlaceholder": "https://example.com",
      "emptyHint": "위에 URL이나 텍스트를 입력하면 QR 코드가 나타납니다.",
      "previewAlt": "QR 코드 미리보기",
      "ecLevel": "오류 복원 수준",
      "ecHint": "높을수록 손상에 강하지만 코드가 더 복잡해집니다.",
      "size": "크기",
      "margin": "여백",
      "fgColor": "전경색",
      "bgColor": "배경색",
      "lowContrast": "전경색과 배경색 대비가 낮아 스캔이 안 될 수 있습니다.",
      "invertedColors": "밝은 전경 / 어두운 배경은 일부 스캐너에서 인식되지 않을 수 있습니다.",
      "renderFailed": "QR 코드를 생성하지 못했습니다. 입력을 확인해 주세요.",
      "downloadPng": "PNG 다운로드",
      "downloadSvg": "SVG 다운로드",
      "copyImage": "이미지 복사",
      "copyFailed": "이 브라우저에서는 복사가 지원되지 않습니다. 다운로드를 사용하세요.",
      "tooLong": "텍스트가 너무 길어 QR 코드에 담을 수 없습니다. 내용을 줄이거나 오류 복원 수준을 낮추세요."
    }
  }
}
```

### `src/i18n/dictionaries/en.json`
```json
{
  "site": { "title": "Useful Tools", "tagline": "Free tools that run right in your browser. Your files never leave your device." },
  "home": { "heading": "Tools", "subheading": "Pick a tool and use it instantly." },
  "categories": { "generator": "Generator" },
  "common": { "download": "Download", "copy": "Copy", "copied": "Copied", "loading": "Loading" },
  "tools": {
    "qr": {
      "title": "QR Code Generator",
      "description": "Turn any link or text into a QR code and save it as PNG or SVG.",
      "inputLabel": "URL or text",
      "inputPlaceholder": "https://example.com",
      "emptyHint": "Enter a URL or text above to see your QR code.",
      "previewAlt": "QR code preview",
      "ecLevel": "Error correction",
      "ecHint": "Higher levels survive more damage but make a denser code.",
      "size": "Size",
      "margin": "Margin",
      "fgColor": "Foreground",
      "bgColor": "Background",
      "lowContrast": "Foreground/background contrast is too low — the code may not scan.",
      "invertedColors": "Light foreground on a dark background may fail on some scanners.",
      "renderFailed": "Could not generate the QR code. Please check your input.",
      "downloadPng": "Download PNG",
      "downloadSvg": "Download SVG",
      "copyImage": "Copy image",
      "copyFailed": "Copy isn’t supported in this browser. Use download instead.",
      "tooLong": "Text is too long to fit in a QR code. Shorten it or lower the error-correction level."
    }
  }
}
```
> ko.json and en.json must be **structurally identical** (`Dictionary` is inferred from ko.json). Every
> `tools.<slug>` block needs at least `{ title, description }` (the grid reads those across all tools).

---

## 7. Routing & Layouts

### `src/app/[locale]/layout.tsx` — the sole root layout
```tsx
import '../globals.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { locales, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { SITE_ORIGIN } from '@/site';
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
    alternates: { canonical: `/${locale}/`, languages: { ko: '/ko/', en: '/en/', 'x-default': '/ko/' } },
    openGraph: {
      type: 'website', siteName: dict.site.title, title: dict.site.title, description: dict.site.tagline,
      url: `/${locale}/`, locale: locale === 'ko' ? 'ko_KR' : 'en_US', images: ['/og.png'],
    },
    twitter: { card: 'summary_large_image', images: ['/og.png'] },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href={`/${locale}`} className="font-semibold">{dict.site.title}</Link>
          <LocaleSwitcher current={locale} />
        </header>
        <div className="mx-auto max-w-3xl px-4 pb-16">{children}</div>
        <footer className="mx-auto max-w-3xl px-4 py-8 text-sm text-neutral-500">{dict.site.tagline}</footer>
      </body>
    </html>
  );
}
```

### `src/app/[locale]/page.tsx`
```tsx
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
```

### `src/app/[locale]/tools/[slug]/page.tsx`
```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { locales, isLocale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { getDictionary } from '@/i18n/dictionaries';
import { tools, getTool } from '@/tools/registry';
import ToolLoader from '@/tools/ToolLoader';
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
    title: t.title,
    description: t.description,
    alternates: {
      canonical: `/${locale}/tools/${slug}/`,
      languages: { ko: `/ko/tools/${slug}/`, en: `/en/tools/${slug}/`, 'x-default': `/ko/tools/${slug}/` },
    },
    // Re-declare type/siteName/locale — Next REPLACES the whole openGraph object on override.
    openGraph: {
      type: 'website', siteName: dict.site.title, locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      title: t.title, description: t.description, url: `${SITE_ORIGIN}/${locale}/tools/${slug}/`, images: ['/og.png'],
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !getTool(slug)) notFound();
  const dict = await getDictionary(locale);
  // Single legitimate cast: `slug` is a raw URL param (string), validated by getTool() above.
  const key = slug as keyof Dictionary['tools'];
  return (
    <main>
      <h1 className="text-2xl font-bold">{dict.tools[key].title}</h1>
      <p className="mt-1 text-neutral-500">{dict.tools[key].description}</p>
      <div className="mt-6">
        <ToolLoader slug={slug} t={dict.tools[key]} common={dict.common} locale={locale} />
      </div>
    </main>
  );
}
```

---

## 8. Tool Registry & Loader (the ONE registry — verified at N=2)

### `src/tools/registry.ts`
```ts
import type { ComponentType } from 'react';
import type { Dictionary } from '@/i18n/dictionaries'; // type-only → no server-only runtime pulled in
import type { Locale } from '@/i18n/config';

type Slug = keyof Dictionary['tools'];

export type ToolProps<S extends Slug = Slug> = {
  t: Dictionary['tools'][S];
  common: Dictionary['common'];
  locale: Locale;
};

// Distributive mapped type: each entry's load() is checked against ITS OWN slug's dict slice.
// (A plain `ComponentType<ToolProps>` with a union `t` compiles at N=1 by accident, then breaks
// EVERY tool at N=2 due to props contravariance. This shape is verified at N=2 in §14.)
export type ToolMeta = {
  [S in Slug]: {
    slug: S;
    category: keyof Dictionary['categories'];
    icon: string;
    keywords: string[];
    load: () => Promise<{ default: ComponentType<ToolProps<S>> }>; // plain import thunk, NOT next/dynamic
  };
}[Slug];

export const tools: ToolMeta[] = [
  {
    slug: 'qr',
    category: 'generator',
    icon: '🔳',
    keywords: ['qr', 'qrcode', 'qr코드', '큐알', '큐알코드'],
    load: () => import('@/tools/qr/QrToolClient'),
  },
];

export function getTool(slug: string): ToolMeta | undefined {
  return tools.find((t) => t.slug === slug);
}
```
> **Why a `load` thunk, not a `next/dynamic` component:** `next/dynamic({ssr:false})` can't be rendered
> in a server component, and `registry.ts` is imported by server components. A plain `() => import(...)`
> thunk is just a function — never executed there, never pulls the client component into the server bundle.

### `src/tools/ToolLoader.tsx`
```tsx
'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { tools, type ToolProps } from '@/tools/registry';

// Hoisted at module scope (next/dynamic requirement) → no useMemo, no remount-drops-user-input risk.
// Locale-agnostic spinner → no i18n leak (no "Loading…" text in the a11y layer).
function Spinner() {
  return (
    <div className="flex justify-center py-8" role="status" aria-hidden="true">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800 dark:border-neutral-700 dark:border-t-neutral-200" />
    </div>
  );
}

// One documented cast: contravariance at the dynamic-dispatch boundary. The registry's mapped type
// already guarantees each load() matches its own slug's slice.
const loaders = Object.fromEntries(
  tools.map((t) => [t.slug, dynamic(t.load as never, { ssr: false, loading: Spinner })]),
) as Record<string, ComponentType<ToolProps>>;

export default function ToolLoader({ slug, t, common, locale }: { slug: string } & ToolProps) {
  const Tool = loaders[slug];
  if (!Tool) return null;
  return <Tool t={t} common={common} locale={locale} />;
}
```

---

## 9. QR Tool

### `src/tools/qr/qr-payload.ts` (PURE — no DOM)
```ts
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type QrOptions = {
  text: string; ecLevel: ErrorCorrectionLevel; size: number; margin: number; fgColor: string; bgColor: string;
};

export const QR_DEFAULTS: QrOptions = { text: '', ecLevel: 'M', size: 256, margin: 4, fgColor: '#000000', bgColor: '#ffffff' };
export const QR_LIMITS = { minSize: 64, maxSize: 1024, minMargin: 0, maxMargin: 16 } as const;

const HEX6 = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (v: string): boolean => HEX6.test(v);
export const normalizeText = (text: string): string => text.trim();
// No fixed length cap: QR capacity is EC-dependent. Let qrcode reject over-capacity input and classify it.
export const isRenderable = (text: string): boolean => normalizeText(text).length > 0;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export function toQrcodeOptions(o: QrOptions) {
  return {
    errorCorrectionLevel: o.ecLevel,
    margin: clamp(Math.round(o.margin), QR_LIMITS.minMargin, QR_LIMITS.maxMargin),
    width: clamp(Math.round(o.size), QR_LIMITS.minSize, QR_LIMITS.maxSize),
    color: {
      dark: isHexColor(o.fgColor) ? o.fgColor : QR_DEFAULTS.fgColor,
      light: isHexColor(o.bgColor) ? o.bgColor : QR_DEFAULTS.bgColor,
    },
  };
}

// The ACTUAL failure path: qrcode throws when data exceeds the EC-level capacity.
export function isCapacityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /too big|code length overflow|amount of data|data too long/i.test(msg);
}

function hexToRgb(hex: string): [number, number, number] {
  const int = HEX6.test(hex) ? parseInt(hex.slice(1), 16) : 0;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export type QrColorWarning = 'low-contrast' | 'inverted' | null;
// QR spec assumes DARK modules on LIGHT background. Check magnitude AND polarity.
export function qrColorWarning(fg: string, bg: string): QrColorWarning {
  if (contrastRatio(fg, bg) < 3) return 'low-contrast';
  if (relativeLuminance(hexToRgb(fg)) >= relativeLuminance(hexToRgb(bg))) return 'inverted';
  return null;
}
```

### `src/tools/qr/qr-payload.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { toQrcodeOptions, isCapacityError, qrColorWarning, contrastRatio, QR_DEFAULTS, QR_LIMITS, isRenderable } from './qr-payload';

describe('isRenderable', () => {
  it('rejects empty/whitespace, accepts content', () => {
    expect(isRenderable('')).toBe(false);
    expect(isRenderable('   ')).toBe(false);
    expect(isRenderable('x')).toBe(true);
  });
});

describe('toQrcodeOptions', () => {
  it('clamps size/margin and falls back on invalid colors', () => {
    const o = toQrcodeOptions({ ...QR_DEFAULTS, size: 99999, margin: -5, fgColor: 'nope', bgColor: '#112233' });
    expect(o.width).toBe(QR_LIMITS.maxSize);
    expect(o.margin).toBe(QR_LIMITS.minMargin);
    expect(o.color.dark).toBe('#000000');
    expect(o.color.light).toBe('#112233');
  });
});

describe('isCapacityError (verifies the REAL coupling to qrcode)', () => {
  it('classifies an actual over-capacity error thrown by qrcode', async () => {
    let err: unknown;
    try { await QRCode.toString('a'.repeat(2000), { type: 'svg', errorCorrectionLevel: 'H' }); }
    catch (e) { err = e; }
    expect(err).toBeInstanceOf(Error);
    expect(isCapacityError(err)).toBe(true); // breaks if qrcode ever changes its message → we WANT that
  });
  it('does not misclassify unrelated errors', () => {
    expect(isCapacityError(new Error('network glitch'))).toBe(false);
  });
});

describe('qrColorWarning (ratio + polarity)', () => {
  it('flags low contrast, inversion, and passes dark-on-light', () => {
    expect(qrColorWarning('#000000', '#ffffff')).toBeNull();
    expect(qrColorWarning('#dddddd', '#ffffff')).toBe('low-contrast');
    expect(qrColorWarning('#ffffff', '#000000')).toBe('inverted');
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(20);
  });
});
```

### `src/tools/qr/QrToolClient.tsx`
```tsx
'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Dictionary } from '@/i18n/dictionaries';
import {
  QR_DEFAULTS, QR_LIMITS, toQrcodeOptions, isRenderable, normalizeText, isCapacityError, qrColorWarning,
  type QrOptions, type ErrorCorrectionLevel,
} from './qr-payload';

type Props = { t: Dictionary['tools']['qr']; common: Dictionary['common']; locale: string };

const EC_LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];
type RenderError = 'none' | 'too-long' | 'generic';

export default function QrToolClient({ t, common }: Props) {
  const [opts, setOpts] = useState<QrOptions>(QR_DEFAULTS);
  const [debouncedText, setDebouncedText] = useState(opts.text);
  const [pngUrl, setPngUrl] = useState('');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<RenderError>('none');
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const set = <K extends keyof QrOptions>(k: K, v: QrOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    const id = setTimeout(() => setDebouncedText(opts.text), 250);
    return () => clearTimeout(id);
  }, [opts.text]);

  // opts.text is deliberately NOT a dependency — only debouncedText drives generation (no stale renders).
  useEffect(() => {
    const text = normalizeText(debouncedText);
    if (!isRenderable(text)) { setPngUrl(''); setSvg(''); setError('none'); return; }
    let cancelled = false;
    const q = toQrcodeOptions(opts);
    Promise.all([
      QRCode.toDataURL(text, { ...q, type: 'image/png' }),
      QRCode.toString(text, { ...q, type: 'svg' }),
    ])
      .then(([png, s]) => { if (!cancelled) { setPngUrl(png); setSvg(s); setError('none'); } })
      .catch((e) => {
        if (cancelled) return;
        setPngUrl(''); setSvg('');
        setError(isCapacityError(e) ? 'too-long' : 'generic'); // capacity AND generic both handled
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText, opts.ecLevel, opts.size, opts.margin, opts.fgColor, opts.bgColor]);

  const warning = qrColorWarning(opts.fgColor, opts.bgColor);

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement('a'); a.href = href; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const onDownloadPng = () => pngUrl && triggerDownload(pngUrl, 'qrcode.png');
  const onDownloadSvg = () => {
    if (!svg) return;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    triggerDownload(url, 'qrcode.svg');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const onCopy = async () => {
    if (!pngUrl) return;
    setCopied(false); setCopyFailed(false);
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) { setCopyFailed(true); return; }
    try {
      // Safari: pass a Promise to ClipboardItem and DON'T await before write(), or activation is lost.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetch(pngUrl).then((r) => r.blob()) })]);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { setCopyFailed(true); }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">{t.inputLabel}</span>
          <textarea value={opts.text} onChange={(e) => set('text', e.target.value)} placeholder={t.inputPlaceholder}
                    rows={3} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    className="mt-1 w-full resize-y rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" />
        </label>

        <div role="radiogroup" aria-label={t.ecLevel}>
          <span className="text-sm font-medium">{t.ecLevel}</span>
          <div className="mt-1 flex gap-2">
            {EC_LEVELS.map((lv) => (
              <button key={lv} type="button" role="radio" aria-checked={opts.ecLevel === lv} onClick={() => set('ecLevel', lv)}
                      className={`rounded px-3 py-1 text-sm ${opts.ecLevel === lv ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{lv}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">{t.ecHint}</p>
        </div>

        <label className="block">
          <span className="text-sm font-medium">{t.size}: {opts.size}px</span>
          <input type="range" min={QR_LIMITS.minSize} max={QR_LIMITS.maxSize} step={16}
                 value={opts.size} onChange={(e) => set('size', Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.margin}: {opts.margin}</span>
          <input type="range" min={QR_LIMITS.minMargin} max={QR_LIMITS.maxMargin}
                 value={opts.margin} onChange={(e) => set('margin', Number(e.target.value))} className="mt-1 w-full" />
        </label>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">{t.fgColor}
            <input type="color" value={opts.fgColor} onChange={(e) => set('fgColor', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm font-medium">{t.bgColor}
            <input type="color" value={opts.bgColor} onChange={(e) => set('bgColor', e.target.value)} /></label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <div className="flex max-w-full items-center justify-center overflow-auto rounded border border-neutral-200 p-4 dark:border-neutral-800"
               style={{ background: opts.bgColor }}>
            {error === 'too-long' ? (
              <p role="alert" className="max-w-xs text-center text-sm text-red-600">{t.tooLong}</p>
            ) : error === 'generic' ? (
              <p role="alert" className="max-w-xs text-center text-sm text-red-600">{t.renderFailed}</p>
            ) : pngUrl ? (
              // width follows the size slider; square image + height:auto keeps aspect; maxWidth caps on small screens.
              <img src={pngUrl} alt={t.previewAlt} style={{ width: opts.size, maxWidth: '100%', height: 'auto' }} />
            ) : (
              <p className="max-w-xs text-center text-sm text-neutral-500">{t.emptyHint}</p>
            )}
          </div>
          {warning && (
            <p role="status" aria-live="polite" className="text-xs text-amber-600">
              {warning === 'low-contrast' ? t.lowContrast : t.invertedColors}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onDownloadPng} disabled={!pngUrl} className="btn-primary">{t.downloadPng}</button>
          <button type="button" onClick={onDownloadSvg} disabled={!svg} className="btn-secondary">{t.downloadSvg}</button>
          {/* No aria-label: the visible text is always a real word, and it changes to common.copied.
              An aria-label would override the text and hide the "copied" state from screen readers. */}
          <button type="button" onClick={onCopy} disabled={!pngUrl} className="btn-secondary">
            {copied ? common.copied : t.copyImage}
          </button>
        </div>
        {/* aria-live announces copy result + failure to screen readers. */}
        <p role="status" aria-live="polite" className="text-xs text-neutral-500">
          {copied ? common.copied : copyFailed ? t.copyFailed : ''}
        </p>
      </div>
    </div>
  );
}
```
> **qrcode API (verified):** `toDataURL(text, {type:'image/png', errorCorrectionLevel, margin, width,
> color:{dark,light}})` → PNG data URI; `toString(text, {type:'svg', ...})` → SVG string.

---

## 10. Shared Components

### `src/components/ToolGrid.tsx` (server)
```tsx
import Link from 'next/link';
import type { ToolMeta } from '@/tools/registry';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';

export default function ToolGrid({ locale, tools, dict }: { locale: Locale; tools: ToolMeta[]; dict: Dictionary }) {
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2">
      {tools.map((t) => {
        const meta = dict.tools[t.slug]; // fully typed — t.slug is keyof Dictionary['tools']
        return (
          <li key={t.slug}>
            <Link href={`/${locale}/tools/${t.slug}`} data-keywords={t.keywords.join(' ')}
                  className="block rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{t.icon}</span>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {dict.categories[t.category]}
                </span>
              </div>
              <div className="mt-2 font-semibold">{meta.title}</div>
              <div className="mt-1 text-sm text-neutral-500">{meta.description}</div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

### `src/components/LocaleSwitcher.tsx` (client)
```tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

export default function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const switchTo = (loc: Locale) => {
    const segs = pathname.split('/'); // ['', 'ko', 'tools', 'qr']
    segs[1] = loc;                    // swap locale segment, preserve the rest
    router.push(segs.join('/') || `/${loc}`);
  };
  return (
    <div className="flex gap-1 text-sm">
      {locales.map((l) => (
        <button key={l} type="button" onClick={() => switchTo(l)} disabled={l === current}
                aria-current={l === current ? 'true' : undefined}
                className={l === current ? 'font-semibold underline' : 'text-neutral-500 hover:text-neutral-900'}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
```

---

## 11. SEO Files

### `src/app/sitemap.ts`
```ts
import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { tools } from '@/tools/registry';
import { SITE_ORIGIN } from '@/site';

export const dynamic = 'force-static'; // REQUIRED under output:'export' or the build fails.

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    entries.push({
      url: `${SITE_ORIGIN}/${locale}/`, lastModified: now, changeFrequency: 'weekly', priority: 1,
      alternates: { languages: { ko: `${SITE_ORIGIN}/ko/`, en: `${SITE_ORIGIN}/en/` } },
    });
    for (const t of tools) {
      entries.push({
        url: `${SITE_ORIGIN}/${locale}/tools/${t.slug}/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8,
        alternates: { languages: { ko: `${SITE_ORIGIN}/ko/tools/${t.slug}/`, en: `${SITE_ORIGIN}/en/tools/${t.slug}/` } },
      });
    }
  }
  return entries;
}
```

### `src/app/robots.ts`
```ts
import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/site';

export const dynamic = 'force-static'; // REQUIRED under output:'export' or the build fails.

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE_ORIGIN}/sitemap.xml`, host: SITE_ORIGIN };
}
```

### `public/og.png`
Static 1200×630 Open Graph image (KakaoTalk/Slack unfurls). Ship a real asset before launch. Dynamic
`opengraph-image.tsx` (`ImageResponse`) is unverified under `output:'export'` — verify before adopting.

---

## 12. Styling & Mobile Notes

- Mobile-first. Single centered column, `max-w-3xl`. Dark mode via Tailwind `dark:` (OS preference).
- QR input is a `<textarea>` with `autoCapitalize="none" autoCorrect="off" spellCheck={false}` — iOS
  Korean keyboards otherwise auto-capitalize/autocorrect URLs. `resize-y` for long WiFi/vCard payloads.

---

## 13. Build Order Checklist

1. Scaffold (`create-next-app@16`), delete default `src/app/layout.tsx` + `src/app/page.tsx`.
2. Config: `src/site.ts`, `next.config.ts`, `postcss.config.mjs`, `globals.css`, `public/_redirects`,
   `wrangler.jsonc`, `vitest.config.ts`, pin `next` exact.
3. i18n: `config.ts`, `dictionaries.ts`, `ko.json`, `en.json`.
4. Routing: `[locale]/layout.tsx`, `[locale]/page.tsx`, `[locale]/tools/[slug]/page.tsx`.
5. SEO: `sitemap.ts` + `robots.ts` (**both need `export const dynamic = 'force-static'`**), `public/og.png`.
6. Registry + loader: `registry.ts`, `ToolLoader.tsx`.
7. QR tool: `qr-payload.ts`, `qr-payload.test.ts`, `QrToolClient.tsx`.
8. Shared: `ToolGrid.tsx`, `LocaleSwitcher.tsx`.
9. Verify (§14).

---

## 14. Verification — ACTUAL run log (Next 16.2.10, pnpm 10, this spec built end-to-end)

```
# pnpm exec vitest run
 Test Files  1 passed (1)
      Tests  5 passed (5)          # includes the REAL over-capacity error from qrcode

# pnpm exec next build
✓ Compiled successfully
  Finished TypeScript in ~1.4s
Route (app)
┌ ○ /_not-found
├ ● /[locale]                 /ko, /en
├ ● /[locale]/tools/[slug]    /ko/tools/qr, /en/tools/qr
├ ○ /robots.txt               (Static)
└ ○ /sitemap.xml              (Static)

# out/ artifacts
EXISTS  out/ko/index.html        EXISTS  out/en/index.html
EXISTS  out/ko/tools/qr/index.html   EXISTS  out/en/tools/qr/index.html
EXISTS  out/sitemap.xml  EXISTS  out/robots.txt  EXISTS  out/404.html  EXISTS  out/_redirects
absent  out/index.html            # root handled by _redirects — correct

# checks
<html lang="ko"> in out/ko, <html lang="en"> in out/en        OK
out/404.html has NO lang attribute                            KNOWN GAP (§17)
grep "Loading…|Redirecting…" out/ko  →  (none)                no English leak
sitemap loc = .../ko/  (trailing slash) + xhtml:link hreflang OK
robots.txt → Sitemap + Host present                          OK
out/ko/tools/qr OG → og:type, og:site_name(=유용한 도구 모음), og:locale(=ko_KR) present  OK

# N=2 (add a 'compress' tool per §16)
✓ Compiled successfully → routes /ko/tools/{qr,compress}, /en/tools/{qr,compress}   BUILD OK
# mis-wire compress.load → QrToolClient:
src/tools/registry.ts: error TS2322: ToolProps<"compress"> is not assignable to Props   CAUGHT (qr stays clean)
```

**Still manual (browser-only, not reproducible in a headless build):** live debounced preview, size
slider resizing the preview, EC toggle, download PNG/SVG, iOS-Safari clipboard copy, `/` → 302 → `/ko/`
via `wrangler dev`. Run `pnpm preview` and exercise `/ko/tools/qr` (§14 checklist below).

Manual checklist on `pnpm preview`: `/` → 302 → `/ko/`; `/ko` → 307 → `/ko/`; type a URL → preview after
~250ms (no stale flashes); drag size → preview grows/shrinks; fg lighter than bg → contrast/inverted
warning; paste huge text at EC=H → `tooLong` (not "enter text"); copy on iOS Safari copies or shows
`copyFailed` (never silent); `/nope/` → 404.html.

---

## 15. Cloudflare Deploy

```bash
pnpm build          # produces ./out (includes _redirects, robots.txt, sitemap.xml)
wrangler deploy     # uploads ./out as Workers Static Assets (first run: `wrangler login`)
```
- Set the real domain **once** in `src/site.ts` before deploy.
- Pure static deploy (no `main` Worker) = no Worker invocation billed. `_redirects` runs at the edge.
- **Future dynamic tool:** add `"main"` + `"binding":"ASSETS"` to `wrangler.jsonc`; Worker handles `/api/*`
  and falls through to `env.ASSETS.fetch(request)`. Same project/domain.

---

## 16. Adding the Next Tool (3 edits — verified by building at N=2, §14)

1. `src/tools/registry.ts` → push `{ slug, category, icon, keywords, load: () => import('@/tools/<slug>/<Comp>') }`.
   `slug` must match a dictionary block (enforced by the type); a mis-wired `load` is a compile error.
2. `ko.json` / `en.json` → add a `tools.<slug>` block (≥ `{ title, description }`).
3. `src/tools/<slug>/<Comp>.tsx` → the client island; props typed `{ t: Dictionary['tools']['<slug>']; common; locale }`.

Grid, `/tools/[slug]` route, static params, sitemap update automatically. **No ToolLoader edit.**

---

## 17. Gotchas (must respect)

1. **No `src/app/layout.tsx`** — `[locale]/layout.tsx` is the sole root layout (per-locale `<html lang>`).
2. **No `/` page** — the root is a CF `_redirects` rule (`/ → /ko/`); no client redirect, no persistence.
3. **`sitemap.ts` + `robots.ts` need `export const dynamic = 'force-static'`** or the export build fails.
4. **`next/dynamic({ssr:false})` can't render in a server component** — isolated in `ToolLoader`; the
   registry stores a plain `load` thunk; the loader is hoisted at module scope (no useMemo).
5. **`images.unoptimized:true`** mandatory or `next/image` fails the export build.
6. **`trailingSlash:true` ⇒ every canonical/sitemap/hreflang URL ends in `/`** or CF returns 307.
   `not_found_handling:"404-page"`; leave `html_handling` default.
7. **ko.json / en.json structurally identical**; every tool block has `{ title, description }`.
8. **`ToolMeta` is a distributive mapped type** — a `ComponentType<union-props>` compiles at N=1 then
   breaks all tools at N=2 (props contravariance). Keep the mapped shape (§8).
9. **`slug: keyof Dictionary['tools']`** — a tool with no dict block is a compile error; the only runtime
   cast is the URL param in `[slug]/page.tsx`, after `getTool` validation.
10. **Clipboard on Safari** — pass a Promise to `ClipboardItem`, never `await` before `write()`;
    feature-detect and surface `copyFailed`. Download is the guaranteed path.
11. **Copy button has NO `aria-label`** — the visible text is the accessible name and changes to
    `common.copied`; an `aria-label` would freeze it. Announce via the `aria-live` region.
12. **Localize `previewAlt`; the loading spinner is wordless** — no English in the ko a11y layer.
13. **Next 16 async params** — `params` is a `Promise`; `await` everywhere. Turbopack is the default.
14. **Known gap:** `out/404.html` has no `<html lang>` (no top-level root layout to set it). Left as-is;
    add a synthetic root layout only if it becomes a real a11y requirement.

---

## CHANGELOG (rev 2 → rev 3, from a second external review that actually built it)

| # | Fix |
|---|---|
| **B1** | **`sitemap.ts` + `robots.ts` broke `output:'export'`.** Added `export const dynamic = 'force-static'` to both. Verified: build now succeeds and both files emit. |
| **B2** | **`ToolMeta` union `ComponentType<ToolProps>` compiled at N=1, broke every tool at N=2** (props contravariance). Replaced with a distributive mapped type correlating `slug`↔slice. Verified: N=2 builds, mis-wire still caught. §16's "3 edits" is now actually true. |
| new #1 | Removed copy button `aria-label` (it froze the a11y name to "Copy image"); state now announced via `aria-live`. |
| new #2 | `isCapacityError` test now triggers a **real** qrcode over-capacity error instead of matching a hand-typed string. |
| new #3 | Non-capacity render errors get a `'generic'` state + `renderFailed` message (rev-2 fixed only the capacity case, left the "enter text" bug for the general case). |
| new #4 | `next/dynamic` **hoisted to module scope** (was inside `useMemo` → remount risk that drops user input); loading fallback is a wordless spinner. |
| new #5 | **Dropped `LocalePreference`** (double page-load for returning users + language bounce on the first home click). Pure `_redirects` → `/ko/`, no persistence. |
| new #6 | Contrast guard now also checks **polarity** (`qrColorWarning` returns `'inverted'` for light-on-dark). |
| new #7 | Tool-page OG re-declares `type`/`siteName`/`locale` (Next replaces the whole `openGraph` on override). Verified in `out/`. |
| minor | Exact pin `pnpm add next@16.2.10 --save-exact`; EC buttons `role="radiogroup"`/`aria-checked`; `aria-live` on warnings/errors; §14.6 dead `Redirecting…` grep removed; sitemap `lastModified` + hreflang `alternates`. |
| honesty | §14 is now an **actual build/test log**, not claims. §2 marks the 404-lang gap and the unverified dynamic-OG path explicitly. |
```
