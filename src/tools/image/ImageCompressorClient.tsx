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

// Island root for all three image slugs (image-compressor / compress-jpg / compress-webp). Reads the
// slug to pick the default output format, then assembles the dropzone, global settings, queue, and
// action bar. Loaded via next/dynamic({ ssr:false }), so this DOM never appears in the static HTML.
export default function ImageCompressorClient({ slug, locale }: ToolProps) {
  const labels = LABELS[locale as Locale] ?? LABELS.en;

  const initial: Settings = {
    preset: 'balanced',
    quality: 0.8,
    format: defaultFormatForSlug(slug),
    resize: { mode: 'none', maxDimension: 1920, percentage: 80, width: 1280, height: 1280, lockAspect: true },
  };
  const [settings, setSettings] = useState<Settings>(initial);
  const [applied, setApplied] = useState<Settings>(initial);

  const { jobs, stats, addFiles, recompressAll, remove, clear, downloadZip, downloadOne } =
    useCompressQueue();

  const hasJobs = jobs.length > 0;
  const dirty = hasJobs && JSON.stringify(settings) !== JSON.stringify(applied);
  const doneCount = stats.done;
  const totalPct =
    stats.originalBytes > 0 ? percentSaved(stats.originalBytes, stats.outputBytes) : 0;

  const onFiles = (files: File[]) => {
    addFiles(files, settings);
    setApplied(settings);
  };
  const onApply = () => {
    recompressAll(settings);
    setApplied(settings);
  };

  return (
    <div className="space-y-6">
      <DropZone labels={labels} onFiles={onFiles} hasJobs={hasJobs} />

      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          labels={labels}
          showApply={dirty}
          onApply={onApply}
        />

        <div>
          {hasJobs ? (
            <>
              <h2 className="text-sm font-semibold">{labels.results}</h2>

              <ul className="mt-1 divide-y divide-neutral-200 dark:divide-neutral-800">
                {jobs.map((job) => (
                  <QueueItem key={job.id} job={job} labels={labels} onDownload={downloadOne} onRemove={remove} />
                ))}
              </ul>

              {/* Action bar: total savings + download-all + clear. */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <p className="text-sm text-neutral-600 dark:text-neutral-400" aria-live="polite">
                  {doneCount > 0 && (
                    <>
                      <span className="font-medium">{labels.total}:</span> {formatBytes(stats.originalBytes)}{' '}
                      <span aria-hidden="true">→</span>{' '}
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">
                        {formatBytes(stats.outputBytes)}
                      </span>{' '}
                      <span className="text-green-700 dark:text-green-400">
                        (-{totalPct}% {labels.savedSuffix})
                      </span>
                    </>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={downloadZip}
                    disabled={doneCount === 0}
                    className="btn-primary"
                  >
                    {labels.downloadZip}
                  </button>
                  <button type="button" onClick={clear} className="btn-secondary">
                    {labels.clearAll}
                  </button>
                </div>
              </div>
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
    </div>
  );
}
