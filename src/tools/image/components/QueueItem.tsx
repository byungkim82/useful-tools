// One row in the batch queue: thumbnail, name, before→after size with a "-NN%" badge, status, and
// per-file actions (edit settings, re-compress, download, remove). An expandable per-image settings
// editor lets one image override the global settings. No 'use client' — imported by the client boundary
// ImageCompressorClient, so it's already in the client bundle.
import { useState } from 'react';
import type { LabelSet } from '../labels';
import type { ViewJob, Settings } from '../useCompressQueue';
import { formatBytes, percentSaved, mayFlattenAlpha } from '../compress-math';
import SettingsPanel from './SettingsPanel';
import CompareSlider from './CompareSlider';

export default function QueueItem({
  job,
  labels,
  settings,
  overridden,
  dirty,
  busy,
  onDownload,
  onRemove,
  onOverride,
  onResetOverride,
  onRecompress,
}: {
  job: ViewJob;
  labels: LabelSet;
  settings: Settings; // effective settings for this image (global, or its override)
  overridden: boolean;
  dirty: boolean; // effective settings differ from the ones that produced the current output
  busy: boolean; // the whole batch is running — hide the re-compress affordance mid-flight
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
  onOverride: (s: Settings) => void;
  onResetOverride: () => void;
  onRecompress: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const pct = job.outSize !== undefined ? percentSaved(job.size, job.outSize) : 0;
  const grew = pct < 0;
  const editable = job.status === 'done' || job.status === 'pending' || job.status === 'error';
  const canCompare = job.status === 'done' && !!job.previewUrl && !!job.outputUrl;

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        {job.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- client-generated blob URL, static export
          <img
            src={job.previewUrl}
            alt=""
            className="h-12 w-12 flex-none rounded object-cover"
            style={{ background: '#f5f5f5' }}
          />
        ) : (
          <div className="h-12 w-12 flex-none rounded bg-neutral-100 dark:bg-neutral-800" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{job.name}</span>
            {overridden && (
              <span className="flex-none rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {labels.customSettings}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{formatBytes(job.size)}</span>
            {job.status === 'done' && job.outSize !== undefined && (
              <>
                <span aria-hidden="true">→</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{formatBytes(job.outSize)}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-medium ${
                    grew ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  }`}
                >
                  {grew ? `+${-pct}%` : `-${pct}%`}
                </span>
              </>
            )}
            {job.status === 'processing' && (
              <span aria-live="polite" className="flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
                />
                {labels.processing}
              </span>
            )}
            {(job.status === 'queued' || job.status === 'pending') && <span>{labels.queued}</span>}
            {job.status === 'error' && (
              <span className="font-medium text-red-600" title={job.error}>
                {labels.failed}
              </span>
            )}
            {job.status === 'canceled' && <span>{labels.canceled}</span>}
            {job.status === 'done' && dirty && !busy && (
              <span className="text-blue-600 dark:text-blue-400">{labels.settingsChanged}</span>
            )}
          </div>
          {job.status === 'done' && job.approximated && (
            <div className="mt-0.5 text-xs text-amber-600">{labels.targetMissed}</div>
          )}
          {job.status === 'done' && job.downscaled && (
            <div className="mt-0.5 text-xs text-amber-600">{labels.downscaledBadge}</div>
          )}
          {job.status === 'done' && job.outFormat && mayFlattenAlpha(job.type, job.outFormat) && (
            <div className="mt-0.5 text-xs text-amber-600">{labels.alphaWarning}</div>
          )}
        </div>

        <div className="flex flex-none items-center gap-1">
          {job.status === 'done' && dirty && !busy && (
            <button
              type="button"
              onClick={onRecompress}
              className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              ↻ {labels.recompress}
            </button>
          )}
          {canCompare && (
            <button
              type="button"
              onClick={() => setCompareOpen((o) => !o)}
              aria-expanded={compareOpen}
              aria-label={labels.compare}
              title={labels.compare}
              className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                compareOpen ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              ⇋
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={labels.editSettings}
              title={labels.editSettings}
              className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                open || overridden ? 'text-blue-600 dark:text-blue-400' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              ⚙
            </button>
          )}
          {job.status === 'done' && (
            <button
              type="button"
              onClick={() => onDownload(job.id)}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              ↓ {labels.download}
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(job.id)}
            aria-label={labels.remove}
            className="rounded px-2 py-1 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            ✕
          </button>
        </div>
      </div>

      {open && editable && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">{labels.perImageSettings}</span>
            {overridden && (
              <button
                type="button"
                onClick={onResetOverride}
                className="text-xs text-neutral-500 underline transition hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                ↺ {labels.resetToDefault}
              </button>
            )}
          </div>
          <SettingsPanel settings={settings} onChange={onOverride} labels={labels} showTitle={false} bare />
        </div>
      )}

      {compareOpen && canCompare && (
        <div className="mt-3">
          <CompareSlider beforeUrl={job.previewUrl!} afterUrl={job.outputUrl!} labels={labels} />
        </div>
      )}
    </li>
  );
}
