# Image Compressor — Implementation Plan (readable)

> A clean summary for an **architect or developer reading this cold**. The review history and intermediate
> decisions are omitted here. The supporting research lives in `image-compressor-research.md`; the full
> decision record with rationale and verification logs lives in `image-compressor-implementation-plan.md`.
> Korean version: `image-compressor-plan-ko.md`.

---

## 1. In one sentence

Build a **batch image compressor that runs entirely in the browser**. You drop files, they're compressed
locally, and nothing is uploaded to a server. It ships as the third tool suite on our site
(tools.solisapps.com, alongside the QR generators and unit converters), in 6 locales
(Korean · English · Spanish · Portuguese-BR · Japanese · German).

**Why we can win:** every big brand (TinyPNG, iLoveIMG, Compressor.io, …) uploads your files to a server.
The combination of *100% client-side + no ads + no limits + a polished batch experience* is something
**nobody currently offers** — that gap is our opening. The privacy angle ("files never leave your device")
is especially strong in the German (GDPR/DSGVO) market.

---

## 2. What we're building

### v1 (first release — the sharp spine)
- **Input:** drag & drop, file picker, add more files mid-session
- **Batch queue:** many images at once; a global setting (quality/format/resize) applies to the whole queue
- **Compression control:** 3 presets (High quality / Balanced / Smallest) + a quality slider
- **Output formats:** JPEG, WebP (both encoded natively by the browser Canvas)
- **Resize:** max dimension / percentage / exact width×height (aspect lock)
- **Metadata:** EXIF stripped by default (privacy + size) + automatic photo-orientation correction
- **Results:** per-file before/after sizes with a "-68%" badge, per-file download, and **download all as ZIP**
- **Privacy surface:** a "no upload · no file limit" hero + a "verify it yourself" section (works with wifi
  off, no image requests in the network tab) + no sign-up, no ads, no watermark
- **Accessibility/theme:** mobile-first, dark mode, baseline a11y

### v1.1 (right after)
Per-image setting overrides · **target file size ("compress to under exactly 100 KB")** · paste (Ctrl+V) ·
folder upload · before/after comparison slider · use-case presets (WhatsApp, email, ID photo — these depend
on target size, so they ship together)

### v1.5 (later)
**AVIF output** (stronger compression, lazy-loaded WASM) · **PNG output + oxipng optimization** (see below) ·
PWA / offline install

### Out of scope
HEIC input (a separate tool — needs a heavy WASM decoder) · AI background removal / upscaling / watermarking
(each a separate product) · server-backed features like live currency rates

> **Why PNG is out of v1:** re-encoding a PNG through the browser Canvas without oxipng doesn't shrink it —
> often it grows. And since PNG is lossless, the quality slider has no effect (it looks broken). So **v1
> accepts PNG as input but only outputs JPEG/WebP**. PNG output returns in v1.5 when oxipng is added.

---

## 3. How it works (the engine)

All processing happens **in the browser**. Zero server code.

**Two core principles:**
1. **Canvas first.** Compression, resizing, and format conversion use built-in browser APIs:
   `createImageBitmap()` (decode + orientation) → `OffscreenCanvas` → `convertToBlob()` (JPEG/WebP encode).
   No extra library or download is needed, so the initial bundle stays small.
2. **Heavy things load late, only on demand.** Multi-megabyte WASM codecs (like AVIF) are lazy-loaded only
   when the user selects that feature. They are never part of the initial load (a performance safeguard).

**Threading / performance:** compression runs in a **Web Worker** so the UI never freezes. Whether this
actually works in a static-export build has **already been verified with a build spike** —
`new Worker(new URL('./worker.ts', import.meta.url))` ships as a same-origin chunk and loads fine under our
current CSP. Only browsers that lack OffscreenCanvas fall back to the main thread.

**Memory:** a single 12-megapixel photo takes ~48 MB once decoded. So we process images **one at a time, or
2–3 at a time**, dropping to a concurrency of 1 for large images and on mobile to avoid iOS Safari's memory
kill (~200–400 MB). Memory is released as soon as each image finishes. Photos larger than the browser's max
Canvas size (iOS 8192², older 4096²) are scaled down automatically — **not silently, but with a badge telling
the user.**

**Target size (v1.1):** "get this image under 100 KB" is hit by binary-searching the quality value; if the
lowest quality still can't reach the target, dimensions are reduced to close the gap.

---

## 4. Fitting the existing codebase

This tool drops in **with the exact same structure as the unit-converter suite**. Just as the converters have
8 slugs (length, weight, temperature, …) sharing one client and picking a category from the slug, the image
compressor has several slugs sharing one `ImageCompressorClient`, picking a variant (which format to
emphasize) from the slug.

| Layer | Reused pattern |
|---|---|
| Tool registration | Add an entry to `src/tools/registry.ts` (`group: 'image'`, icon, keywords, loader) |
| Client mount | `ToolLoader` loads it via `next/dynamic({ ssr: false })` — browser-only code stays out of static HTML |
| Tool page | Existing `[slug]/page.tsx` handles SEO meta, JSON-LD, static copy. Add `ImageTypeNav` for the image group |
| i18n | Add tool blocks to all 6 locale dictionaries (structurally identical) |
| UI strings | Kept **in code** as a label map, like the converter's `labels.ts`. Locale JSON holds SEO copy only |
| Home / nav | One card on the home grid, an in-tool format switcher |

**Two invariants that must hold:**
1. Every tool block must be **structurally identical across all 6 locales** (enforced by `check-i18n.mjs`).
   The type system relies on this.
2. The tool DOM is **`ssr:false`** — it must not appear in static HTML. That's where Canvas/File APIs live.

---

## 5. File layout

Everything lives under `src/tools/image/`, with a clear boundary between **pure logic (testable)** and
**browser-only code**.

```
src/tools/image/
  compress-math.ts       # pure: resize math, byte formatting ("1.2 MB"), % saved, output filenames, presets
  queue-reducer.ts       # pure: batch queue transitions + concurrency decisions (the riskiest logic → unit-tested)
  compress-math.test.ts  # Vitest unit tests for the pure functions above
  encode.ts              # browser: createImageBitmap → OffscreenCanvas → convertToBlob
  compress.worker.ts     # browser: worker entry (uses encode, postMessage protocol)
  useCompressQueue.ts    # browser: a thin hook wiring queue-reducer to the worker/timers/memory cleanup
  labels.ts              # UI string label map (with locale overrides)
  ImageCompressorClient.tsx  # island root — assembles dropzone, settings, queue, results
  ImageTypeNav.tsx       # format switcher nav
  components/            # DropZone, QueueItem, SettingsPanel, StatBadge …
```

> **Testing strategy:** the actual encoding is a browser API and can't be unit-tested, but **the risky logic
> is extracted into pure functions and tested.** In particular the batch queue (transitions, concurrency,
> cancel, release) and the resize math are verified in Vitest by injecting a fake encoder. Real encoding and
> the worker are covered by headless-browser verification (§8).

---

## 6. Infrastructure

- **Exactly one CSP change:** add `blob:` to `img-src` in `public/_headers`. Previews, thumbnails, and
  downloads use `URL.createObjectURL()` (the `blob:` scheme). **The worker is same-origin, so the current CSP
  already allows it** — no extra directive needed (confirmed by the spike). COEP stays off (protects the
  analytics beacon).
- **Libraries:** just `fflate` (~8 KB, for the "download all" ZIP). WASM codecs (AVIF, etc.) are lazy-loaded
  in v1.5. Target for the initial island bundle is under 30 KB gzipped.
- **Deploy:** `pnpm run deploy` (⚠️ not `pnpm deploy` — the workspace builtin shadows the script). Static
  export → Cloudflare Workers static assets, zero server cost.

---

## 7. i18n & SEO

- **Three slugs (v1):** `image-compressor` (primary) · `compress-jpg` · `compress-webp`, all sharing one
  client. Tool count goes 17 → 20, and static routes go 108 → **126** (6 locales × 21).
- **Locales are market angles, not translations.** e.g. Germany leads with "ohne Upload · DSGVO-konform",
  Brazil with WhatsApp attachments, Korea with "shrink ID/résumé photo size", Japan with "軽量化 ·
  アップロードなし". These angles go into the SEO title/description only; the FAQ/feature arrays stay
  structurally identical across all 6 locales.
- **Structured data:** each page carries `WebApplication` + `FAQPage` + **`HowTo`** (the compression steps).
  Since the tool itself is `ssr:false` (thin static HTML), we fill in crawlable copy (how-to, features, FAQ)
  server-rendered so the pages have real text to rank on.

---

## 8. Verification (always run after building)

**Build/structure:** `pnpm test && pnpm lint && pnpm build` + `check-i18n.mjs` (identical structure across
6 locales → ALL GOOD). In the built `out/`, check the 3 new pages' titles/meta/JSON-LD, the absent ssr:false
marker, the home card, nav links, and the sitemap URL count.

**Real browser (headless + live after deploy):**
- A real compression round-trip: drop an image → output is smaller than input → format conversion (WebP) works
- WebP encode feature-detect (fall back explicitly to JPEG instead of silently to PNG on old Safari)
- EXIF removal confirmed (no GPS/orientation tags in output) + rotated photos don't come out sideways
- An oversized photo scales down without crashing and shows the badge
- A 20-image batch completes without running out of memory
- **Privacy proof:** zero image-carrying requests in the network tab
- Zero CSP violations, the analytics beacon still loads, all 6 locale pages return 200

---

## 9. Build order

1. **P0-b — pure core + tests.** `compress-math.ts` and the queue reducer + Vitest. (No browser needed; start here)
2. **P1 — single-image island.** Drop 1 → quality/format/resize → download. Wire the worker + CSP, verify headless.
3. **P2 — batch + conveniences (the spine).** Queue, adaptive concurrency, stats, ZIP, EXIF toggle.
4. **P3 — registration/nav/home.** 3 registry entries, format nav, home card.
5. **P4 — i18n + SEO.** Author KO/EN, translate the other 4 locales, run the structure check. HowTo structured data.
6. **P5 — verify → deploy.** All of §8 → `pnpm run deploy` → re-check live.

> **The engine path (worker in static export) is already settled by the spike**, so the only remaining
> uncertainty is real-device memory and quality — and those get confirmed by actually running P1–P2.

---

## 10. Open risks

The build/bundle uncertainties are closed by the spike. What remains is the "only known once you run it" kind:

- **Mobile memory.** iOS Safari can kill the tab on large photos / big batches → defended by adaptive
  concurrency, but confirm on a real device.
- **WebP's Safari tail.** Very old Safari may silently drop WebP encode to PNG → feature-detect and fall back
  to JPEG. Low probability, but cheap insurance, so we include it.
- **Auto orientation.** EXIF orientation handling differs per browser, so test with actually-rotated photos.

None of these are "catastrophic but unlikely" — they're all "just needs confirming." The defenses are already
built into the design.
