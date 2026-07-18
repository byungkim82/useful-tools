// One row in the batch queue: thumbnail, name, before→after size with a "-NN%" badge, status, and
// per-file download/remove. No 'use client' — imported by the client boundary ImageCompressorClient.
import type { LabelSet } from '../labels';
import type { ViewJob } from '../useCompressQueue';
import { formatBytes, percentSaved, mayFlattenAlpha } from '../compress-math';

export default function QueueItem({
  job,
  labels,
  onDownload,
  onRemove,
}: {
  job: ViewJob;
  labels: LabelSet;
  onDownload: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const pct = job.outSize !== undefined ? percentSaved(job.size, job.outSize) : 0;
  const grew = pct < 0;

  return (
    <li className="flex items-center gap-3 py-3">
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
        <div className="truncate text-sm font-medium">{job.name}</div>
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
          {job.status === 'error' && <span className="font-medium text-red-600">{labels.failed}</span>}
          {job.status === 'canceled' && <span>{labels.canceled}</span>}
        </div>
        {job.status === 'done' && job.downscaled && (
          <div className="mt-0.5 text-xs text-amber-600">{labels.downscaledBadge}</div>
        )}
        {job.status === 'done' && job.outFormat && mayFlattenAlpha(job.type, job.outFormat) && (
          <div className="mt-0.5 text-xs text-amber-600">{labels.alphaWarning}</div>
        )}
      </div>

      <div className="flex flex-none items-center gap-1">
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
    </li>
  );
}
