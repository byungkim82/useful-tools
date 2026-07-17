'use client';

import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import {
  QR_DEFAULTS, QR_LIMITS, toQrcodeOptions, isRenderable, normalizeText, isCapacityError, qrColorWarning,
  type QrOptions, type ErrorCorrectionLevel,
} from './qr-payload';

const EC_LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H'];
type RenderError = 'none' | 'too-long' | 'generic';

// Shared control labels every QR-family tool needs. Each tool's dict slice is structurally assignable
// to this, so it can be passed straight through as `labels`.
export type QrToolLabels = {
  ecLevel: string; ecHint: string; size: string; margin: string; fgColor: string; bgColor: string;
  lowContrast: string; invertedColors: string; renderFailed: string; tooLong: string;
  downloadPng: string; downloadSvg: string; copyImage: string; copyFailed: string; previewAlt: string;
};

type QrRenderOptions = Omit<QrOptions, 'text'>;
const DEFAULT_OPTIONS: QrRenderOptions = {
  ecLevel: QR_DEFAULTS.ecLevel, size: QR_DEFAULTS.size, margin: QR_DEFAULTS.margin,
  fgColor: QR_DEFAULTS.fgColor, bgColor: QR_DEFAULTS.bgColor,
};

// Owns QR options (EC/size/margin/color), the debounced render, preview, and download/copy. The
// type-specific input form is passed as `children`; the composed payload string arrives via `text`.
// One instance per page — a client island loaded ssr:false, so this DOM stays out of the static HTML.
export default function QrCodeTool({
  text, emptyHint, labels, common, children,
}: {
  text: string;
  emptyHint: string;
  labels: QrToolLabels;
  common: { copied: string };
  children: ReactNode;
}) {
  const [opts, setOpts] = useState<QrRenderOptions>(DEFAULT_OPTIONS);
  const [debounced, setDebounced] = useState<QrOptions>({ ...DEFAULT_OPTIONS, text });
  // One result object, set ONLY inside async callbacks (no synchronous setState in an effect body).
  const [result, setResult] = useState<{ png: string; svg: string; error: RenderError }>({ png: '', svg: '', error: 'none' });
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const set = <K extends keyof QrRenderOptions>(k: K, v: QrRenderOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  // Debounce text + options → one regeneration 250ms after any change (covers slider/color drags and
  // typing). The preview scales instantly via CSS below.
  useEffect(() => {
    const id = setTimeout(() => setDebounced({ ...opts, text }), 250);
    return () => clearTimeout(id);
  }, [text, opts]);

  useEffect(() => {
    const value = normalizeText(debounced.text);
    if (!isRenderable(value)) return; // empty is handled by render-gating; keeps the effect setState-free
    let cancelled = false;
    const q = toQrcodeOptions(debounced);
    Promise.all([
      QRCode.toDataURL(value, { ...q, type: 'image/png' }),
      QRCode.toString(value, { ...q, type: 'svg' }),
    ])
      .then(([png, s]) => { if (!cancelled) setResult({ png, svg: s, error: 'none' }); })
      .catch((e) => { if (!cancelled) setResult({ png: '', svg: '', error: isCapacityError(e) ? 'too-long' : 'generic' }); })
    ;
    return () => { cancelled = true; };
  }, [debounced]);

  // Render-gate on the CURRENT debounced text so clearing inputs shows the empty hint without a
  // synchronous reset. While regenerating, the previous QR stays put (no flicker to empty).
  const renderable = isRenderable(debounced.text);
  const pngUrl = renderable ? result.png : '';
  const svg = renderable ? result.svg : '';
  const error: RenderError = renderable ? result.error : 'none';
  const warning = qrColorWarning(opts.fgColor, opts.bgColor);

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement('a');
    a.href = href; a.download = filename;
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
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { setCopyFailed(true); }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        {children}

        {/* Native radios: arrow-key navigation, focus, and form semantics come for free. */}
        <fieldset>
          <legend className="text-sm font-medium">{labels.ecLevel}</legend>
          <div className="mt-1 flex gap-2">
            {EC_LEVELS.map((lv) => (
              <label
                key={lv}
                className={`cursor-pointer rounded px-3 py-1 text-sm focus-within:ring-2 focus-within:ring-neutral-500 ${
                  opts.ecLevel === lv ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'
                }`}
              >
                <input
                  type="radio" name="ec-level" value={lv} checked={opts.ecLevel === lv}
                  onChange={() => set('ecLevel', lv)} className="sr-only"
                />
                {lv}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-neutral-500">{labels.ecHint}</p>
        </fieldset>

        <label className="block">
          <span className="text-sm font-medium">{labels.size}: {opts.size}px</span>
          <input type="range" min={QR_LIMITS.minSize} max={QR_LIMITS.maxSize} step={16}
                 value={opts.size} onChange={(e) => set('size', Number(e.target.value))} className="mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{labels.margin}: {opts.margin}</span>
          <input type="range" min={QR_LIMITS.minMargin} max={QR_LIMITS.maxMargin}
                 value={opts.margin} onChange={(e) => set('margin', Number(e.target.value))} className="mt-1 w-full" />
        </label>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">{labels.fgColor}
            <input type="color" value={opts.fgColor} onChange={(e) => set('fgColor', e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm font-medium">{labels.bgColor}
            <input type="color" value={opts.bgColor} onChange={(e) => set('bgColor', e.target.value)} /></label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          <div className="flex max-w-full items-center justify-center overflow-auto rounded border border-neutral-200 p-4 dark:border-neutral-800"
               style={{ background: opts.bgColor }}>
            {error === 'too-long' ? (
              <p role="alert" className="max-w-xs text-center text-sm text-red-600">{labels.tooLong}</p>
            ) : error === 'generic' ? (
              <p role="alert" className="max-w-xs text-center text-sm text-red-600">{labels.renderFailed}</p>
            ) : pngUrl ? (
              // width follows the LIVE size slider (instant CSS scale); regeneration is debounced.
              // next/image is wrong here: a client-generated data URL, static export, images.unoptimized.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pngUrl} alt={labels.previewAlt} style={{ width: opts.size, maxWidth: '100%', height: 'auto' }} />
            ) : (
              <p className="max-w-xs text-center text-sm text-neutral-500">{emptyHint}</p>
            )}
          </div>
          {warning && (
            <p role="status" aria-live="polite" className="text-xs text-amber-600">
              {warning === 'low-contrast' ? labels.lowContrast : labels.invertedColors}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onDownloadPng} disabled={!pngUrl} className="btn-primary">{labels.downloadPng}</button>
          <button type="button" onClick={onDownloadSvg} disabled={!svg} className="btn-secondary">{labels.downloadSvg}</button>
          {/* Stable text = stable accessible name. Success/failure is announced by the live region below,
              so the name never changes (no double announcement, no label-in-name mismatch). */}
          <button type="button" onClick={onCopy} disabled={!pngUrl} className="btn-secondary">{labels.copyImage}</button>
        </div>
        <p role="status" aria-live="polite" className="min-h-4 text-xs text-neutral-500">
          {copied ? common.copied : copyFailed ? labels.copyFailed : ''}
        </p>
      </div>
    </div>
  );
}
