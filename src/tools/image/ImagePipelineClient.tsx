'use client';

import { useEffect, useRef, useState } from 'react';
import type { LabelSet } from './labels';
import { formatBytes, percentSaved, type FormatChoice } from './compress-math';
import { HEIC_UNSUPPORTED } from './runner';
import { useCompressQueue, type Settings } from './useCompressQueue';
import DropZone from './components/DropZone';
import SettingsPanel from './components/SettingsPanel';
import QueueItem from './components/QueueItem';

// Shared island for the image compressor AND the HEIC converter — both are the same pipeline (drop →
// queue → settings → run → download), differing only in labels, the file-picker `accept`, and the
// default output format. Kept generic so the two thin wrappers (ImageCompressorClient, HeicClient) don't
// duplicate the orchestration. Nothing is processed until the user presses the primary button. Loaded
// ssr:false by ToolLoader, so this DOM is not in the static HTML.
export type ImagePipelineProps = {
  labels: LabelSet;
  accept: string; // DropZone file-input filter
  initialFormat: FormatChoice;
  // HEIC-only: message shown when a job fails because the platform can't run the libheif worker.
  unsupportedLabel?: string;
};

export default function ImagePipelineClient({ labels, accept, initialFormat, unsupportedLabel }: ImagePipelineProps) {
  const initial: Settings = {
    preset: 'balanced',
    quality: 0.8,
    format: initialFormat,
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
  // Surface the "unsupported browser" state for HEIC when a job failed because the worker can't run.
  const showUnsupported = !!unsupportedLabel && jobs.some((j) => j.status === 'error' && j.error === HEIC_UNSUPPORTED);
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

  // Paste images from the clipboard (Ctrl/Cmd+V) — the screenshot workflow. A ref keeps the always-fresh
  // handler so the document listener is attached once and never goes stale.
  const onFilesRef = useRef(onFiles);
  useEffect(() => {
    onFilesRef.current = onFiles; // sync in an effect, not during render
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        e.preventDefault();
        onFilesRef.current(files);
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, []);
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

  // The single primary action: run pending → re-run stale → progress while running.
  let primary: { label: string; onClick?: () => void; disabled?: boolean } | null = null;
  if (isProcessing) primary = { label: `${labels.compressing} ${c.done}/${runTotal}`, disabled: true };
  else if (c.pending > 0) primary = { label: `${labels.compress} (${c.pending})`, onClick: onCompress };
  else if (canRecompress) primary = { label: `${labels.recompress} (${dirtyIds.length})`, onClick: () => onRecompress(dirtyIds) };

  return (
    <div className="space-y-6">
      <DropZone labels={labels} onFiles={onFiles} hasJobs={hasJobs} accept={accept} />
      {notice && (
        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {notice}
        </p>
      )}
      {showUnsupported && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {unsupportedLabel}
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

      {/* Prominent action bar: the primary run/re-run button + completion summary + ZIP. */}
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
