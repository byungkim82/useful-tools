'use client';

import { useState } from 'react';
import type { ToolProps } from '@/tools/registry';
import type { Locale } from '@/i18n/config';
import { LABELS } from './labels';
import { defaultFormatForSlug, formatBytes, percentSaved } from './compress-math';
import { useCompressQueue, type Settings } from './useCompressQueue';
import DropZone from './components/DropZone';
import SettingsPanel from './components/SettingsPanel';
import QueueItem from './components/QueueItem';

// Island root for all three image slugs. Flow: drop images (they wait as "pending") → adjust the global
// settings → press Compress. Nothing is processed until the user asks, and the result state is made
// explicit so a finished compression is impossible to miss. Loaded ssr:false, so this DOM is not in the
// static HTML.
export default function ImageCompressorClient({ slug, locale }: ToolProps) {
  const labels = LABELS[locale as Locale] ?? LABELS.en;

  const initial: Settings = {
    preset: 'balanced',
    quality: 0.8,
    format: defaultFormatForSlug(slug),
    resize: { mode: 'none', maxDimension: 1920, percentage: 80, width: 1280, height: 1280, lockAspect: true },
    target: { enabled: false, kb: 200 },
  };
  const [settings, setSettings] = useState<Settings>(initial);
  // Per-image overrides: a full Settings snapshot for any image the user customised (absent → use global).
  const [overrides, setOverrides] = useState<Record<string, Settings>>({});
  // The settings that produced each finished job's current output — used to detect which are now stale.
  const [appliedFor, setAppliedFor] = useState<Record<string, Settings>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const { jobs, stats, addFiles, compressAll, recompress, remove, clear, downloadZip, downloadOne } =
    useCompressQueue();

  const resolve = (id: string): Settings => overrides[id] ?? settings;

  const c = { pending: 0, queued: 0, processing: 0, done: 0, error: 0, canceled: 0 };
  for (const j of jobs) c[j.status]++;
  const inFlight = c.queued + c.processing;
  const isProcessing = inFlight > 0;
  const finished = c.done + c.error;
  const runTotal = finished + inFlight;
  const hasJobs = jobs.length > 0;
  // A done job is dirty when its effective settings no longer match the ones that produced its output.
  const dirtyIds = jobs
    .filter((j) => j.status === 'done' && appliedFor[j.id] !== undefined)
    .filter((j) => JSON.stringify(resolve(j.id)) !== JSON.stringify(appliedFor[j.id]))
    .map((j) => j.id);
  const canRecompress = !isProcessing && c.pending === 0 && dirtyIds.length > 0;
  const totalPct = stats.originalBytes > 0 ? percentSaved(stats.originalBytes, stats.outputBytes) : 0;

  const recordApplied = (ids: string[]) =>
    setAppliedFor((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = resolve(id);
      return next;
    });

  const onFiles = (files: File[]) => {
    const { rejected } = addFiles(files);
    setNotice(rejected > 0 ? labels.skipped.replace('{n}', String(rejected)) : null);
  };
  const onCompress = () => {
    const ids = jobs.filter((j) => j.status === 'pending').map((j) => j.id);
    compressAll(resolve);
    recordApplied(ids);
    setNotice(null);
  };
  const onRecompress = (ids: string[]) => {
    recompress(resolve, ids);
    recordApplied(ids);
  };

  const setOverride = (id: string, s: Settings) => setOverrides((prev) => ({ ...prev, [id]: s }));
  const clearOverride = (id: string) =>
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  const onRemove = (id: string) => {
    remove(id);
    clearOverride(id);
    setAppliedFor((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const onClear = () => {
    clear();
    setOverrides({});
    setAppliedFor({});
  };

  // The single primary action: Compress pending → Re-compress stale → progress while running.
  let primary: { label: string; onClick?: () => void; disabled?: boolean } | null = null;
  if (isProcessing) primary = { label: `${labels.compressing} ${c.done}/${runTotal}`, disabled: true };
  else if (c.pending > 0) primary = { label: `${labels.compress} (${c.pending})`, onClick: onCompress };
  else if (canRecompress) primary = { label: `${labels.recompress} (${dirtyIds.length})`, onClick: () => onRecompress(dirtyIds) };

  return (
    <div className="space-y-6">
      <DropZone labels={labels} onFiles={onFiles} hasJobs={hasJobs} />
      {notice && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {notice}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
        <SettingsPanel settings={settings} onChange={setSettings} labels={labels} />

        <div>
          {hasJobs ? (
            <>
              <h2 className="text-sm font-semibold">{labels.results}</h2>
              <ul className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-800">
                {jobs.map((job) => (
                  <QueueItem
                    key={job.id}
                    job={job}
                    labels={labels}
                    settings={resolve(job.id)}
                    overridden={overrides[job.id] !== undefined}
                    dirty={dirtyIds.includes(job.id)}
                    busy={isProcessing}
                    onDownload={downloadOne}
                    onRemove={onRemove}
                    onOverride={(s) => setOverride(job.id, s)}
                    onResetOverride={() => clearOverride(job.id)}
                    onRecompress={() => onRecompress([job.id])}
                  />
                ))}
              </ul>
            </>
          ) : (
            <div
              className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400 dark:border-neutral-800"
              data-compressor-empty
            >
              {labels.dropHint}
            </div>
          )}
        </div>
      </div>

      {/* Prominent action bar: the primary Compress/Re-compress button + completion summary + ZIP. */}
      {hasJobs && (
        <div className="sticky bottom-0 space-y-3 border-t border-neutral-200 bg-white/90 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
          {primary && (
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              aria-live="polite"
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
            >
              {primary.disabled && (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent dark:border-neutral-600 dark:border-t-transparent"
                />
              )}
              {primary.label}
            </button>
          )}

          {c.done > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-neutral-700 dark:text-neutral-300" aria-live="polite">
                <span className="font-semibold text-green-700 dark:text-green-400">
                  ✓ {labels.done} {c.done}/{jobs.length - c.canceled}
                </span>
                {' · '}
                {formatBytes(stats.originalBytes)} <span aria-hidden="true">→</span>{' '}
                <span className="font-medium">{formatBytes(stats.outputBytes)}</span>{' '}
                <span className="text-green-700 dark:text-green-400">(-{totalPct}% {labels.savedSuffix})</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={downloadZip} className="btn-primary">
                  {labels.downloadZip}
                </button>
                <button type="button" onClick={onClear} className="btn-secondary">
                  {labels.clearAll}
                </button>
              </div>
            </div>
          )}

          {c.done === 0 && (
            <div className="flex justify-end">
              <button type="button" onClick={clear} className="btn-secondary">
                {labels.clearAll}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
