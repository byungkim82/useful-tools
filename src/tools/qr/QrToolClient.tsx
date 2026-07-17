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
  const [debounced, setDebounced] = useState<QrOptions>(opts);
  // One result object, set ONLY inside async callbacks (no synchronous setState in an effect body).
  const [result, setResult] = useState<{ png: string; svg: string; error: RenderError }>({ png: '', svg: '', error: 'none' });
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const set = <K extends keyof QrOptions>(k: K, v: QrOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  // Debounce the WHOLE options object → one regeneration 250ms after any change (covers slider/color
  // drags, which are the only continuous inputs). The preview scales instantly via CSS below.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(opts), 250);
    return () => clearTimeout(id);
  }, [opts]);

  useEffect(() => {
    const text = normalizeText(debounced.text);
    if (!isRenderable(text)) return; // empty is handled by render-gating; keeps the effect setState-free
    let cancelled = false;
    const q = toQrcodeOptions(debounced);
    Promise.all([
      QRCode.toDataURL(text, { ...q, type: 'image/png' }),
      QRCode.toString(text, { ...q, type: 'svg' }),
    ])
      .then(([png, s]) => { if (!cancelled) setResult({ png, svg: s, error: 'none' }); })
      .catch((e) => { if (!cancelled) setResult({ png: '', svg: '', error: isCapacityError(e) ? 'too-long' : 'generic' }); })
    ;
    return () => { cancelled = true; };
  }, [debounced]);

  // Render-gate on the CURRENT debounced text so clearing the box shows the empty hint without a
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
        <label className="block">
          <span className="text-sm font-medium">{t.inputLabel}</span>
          <textarea
            value={opts.text} onChange={(e) => set('text', e.target.value)} placeholder={t.inputPlaceholder}
            rows={3} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            className="mt-1 w-full resize-y rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>

        {/* Native radios: arrow-key navigation, focus, and form semantics come for free. */}
        <fieldset>
          <legend className="text-sm font-medium">{t.ecLevel}</legend>
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
          <p className="mt-1 text-xs text-neutral-500">{t.ecHint}</p>
        </fieldset>

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
              // width follows the LIVE size slider (instant CSS scale); regeneration is debounced.
              // next/image is wrong here: a client-generated data URL, static export, images.unoptimized.
              // eslint-disable-next-line @next/next/no-img-element
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
          {/* Stable text = stable accessible name. Success/failure is announced by the live region below,
              so the name never changes (no double announcement, no label-in-name mismatch). */}
          <button type="button" onClick={onCopy} disabled={!pngUrl} className="btn-secondary">{t.copyImage}</button>
        </div>
        <p role="status" aria-live="polite" className="min-h-4 text-xs text-neutral-500">
          {copied ? common.copied : copyFailed ? t.copyFailed : ''}
        </p>
      </div>
    </div>
  );
}
