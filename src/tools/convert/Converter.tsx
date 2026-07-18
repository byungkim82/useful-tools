'use client';

import { useState } from 'react';
import { localeMeta, type Locale } from '@/i18n/config';
import { convert, unitsOf, parseLocaleNumber, formatNumber, type CategoryId } from './units';
import { unitLabel, CHROME } from './labels';

// Shared converter widget. The category is fixed by the tool slug (one thin wrapper per category).
// All labels come from ./labels (code, not i18n); only SEO copy lives in the per-locale JSON.
export default function Converter({ category, locale }: { category: CategoryId; locale: Locale }) {
  const units = unitsOf(category);
  const [value, setValue] = useState('');
  const [from, setFrom] = useState(units[0]);
  const [copied, setCopied] = useState<string | null>(null);

  const bcp47 = localeMeta[locale].lang; // e.g. 'pt' → 'pt-BR', so Intl parses/formats correctly
  const chrome = CHROME[locale];
  const parsed = parseLocaleNumber(value, bcp47);

  const inputClass =
    'w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900';

  async function copy(text: string, unit: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(unit);
      setTimeout(() => setCopied((u) => (u === unit ? null : u)), 1500);
    } catch {
      /* clipboard unavailable — the value is already visible to select manually */
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="block sm:flex-1">
          <span className="text-sm font-medium">{chrome.placeholder}</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="block sm:w-56">
          <span className="text-sm font-medium">{chrome.unit}</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={`mt-1 ${inputClass}`}>
            {units.map((u) => (
              <option key={u} value={u}>{unitLabel(u, locale)}</option>
            ))}
          </select>
        </label>
      </div>

      <h2 className="mt-6 text-sm font-medium text-neutral-500">{chrome.results}</h2>
      {parsed === null ? (
        <p className="mt-2 text-sm text-neutral-500">{chrome.emptyHint}</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
          {units.filter((u) => u !== from).map((u) => {
            const out = formatNumber(convert(category, from, u, parsed), bcp47);
            return (
              <li key={u} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm text-neutral-500">{unitLabel(u, locale)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{out}</span>
                  <button
                    type="button"
                    onClick={() => copy(out, u)}
                    className="rounded px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {copied === u ? '✓' : chrome.copy}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
