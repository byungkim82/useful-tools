// Global compression settings applied to the whole queue (v1: one setting for all images; per-image
// overrides are v1.1). No 'use client' — imported by the client boundary ImageCompressorClient.
import type { LabelSet } from '../labels';
import { presetQuality, type FormatChoice, type Preset, type ResizeMode } from '../compress-math';
import type { Settings } from '../useCompressQueue';

const inputClass =
  'w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900';

const PRESETS: { key: Exclude<Preset, 'custom'>; label: (l: LabelSet) => string }[] = [
  { key: 'high', label: (l) => l.presetHigh },
  { key: 'balanced', label: (l) => l.presetBalanced },
  { key: 'smallest', label: (l) => l.presetSmallest },
];

export default function SettingsPanel({
  settings,
  onChange,
  labels,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  labels: LabelSet;
}) {
  const quality = presetQuality(settings.preset, settings.quality);
  const { resize } = settings;
  const setResize = (patch: Partial<Settings['resize']>) => onChange({ ...settings, resize: { ...resize, ...patch } });

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-semibold">{labels.settingsTitle}</h2>

      {/* Presets + quality slider (moving the slider switches to custom). */}
      <div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ ...settings, preset: p.key })}
              className={`rounded px-3 py-1 text-sm transition ${
                settings.preset === p.key
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
              }`}
            >
              {p.label(labels)}
            </button>
          ))}
        </div>
        <label className="mt-3 block">
          <span className="text-sm font-medium">
            {labels.quality}: {Math.round(quality * 100)}
            {settings.preset === 'custom' ? ` · ${labels.custom}` : ''}
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={quality}
            onChange={(e) => onChange({ ...settings, preset: 'custom', quality: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
      </div>

      {/* Output format */}
      <label className="block">
        <span className="text-sm font-medium">{labels.outputFormat}</span>
        <select
          value={settings.format}
          onChange={(e) => onChange({ ...settings, format: e.target.value as FormatChoice })}
          className={`mt-1 ${inputClass}`}
        >
          <option value="auto">{labels.formatAuto}</option>
          <option value="jpeg">{labels.formatJpeg}</option>
          <option value="webp">{labels.formatWebp}</option>
        </select>
      </label>

      {/* Resize */}
      <label className="block">
        <span className="text-sm font-medium">{labels.resize}</span>
        <select
          value={resize.mode}
          onChange={(e) => setResize({ mode: e.target.value as ResizeMode })}
          className={`mt-1 ${inputClass}`}
        >
          <option value="none">{labels.resizeNone}</option>
          <option value="maxDimension">{labels.resizeMax}</option>
          <option value="percentage">{labels.resizePercent}</option>
          <option value="exact">{labels.resizeExact}</option>
        </select>
      </label>

      {resize.mode === 'maxDimension' && (
        <label className="block">
          <span className="text-sm font-medium">
            {labels.resizeMax}: {resize.maxDimension ?? 1920}px
          </span>
          <input
            type="range"
            min={128}
            max={8192}
            step={64}
            value={resize.maxDimension ?? 1920}
            onChange={(e) => setResize({ maxDimension: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
      )}

      {resize.mode === 'percentage' && (
        <label className="block">
          <span className="text-sm font-medium">{resize.percentage ?? 80}%</span>
          <input
            type="range"
            min={1}
            max={100}
            step={1}
            value={resize.percentage ?? 80}
            onChange={(e) => setResize({ percentage: Number(e.target.value) })}
            className="mt-1 w-full"
          />
        </label>
      )}

      {resize.mode === 'exact' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="text-xs text-neutral-500">{labels.width}</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={resize.width ?? ''}
                onChange={(e) => setResize({ width: e.target.value ? Number(e.target.value) : undefined })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block flex-1">
              <span className="text-xs text-neutral-500">{labels.height}</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={resize.height ?? ''}
                onChange={(e) => setResize({ height: e.target.value ? Number(e.target.value) : undefined })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={resize.lockAspect ?? true}
              onChange={(e) => setResize({ lockAspect: e.target.checked })}
            />
            {labels.lockAspect}
          </label>
        </div>
      )}
    </div>
  );
}
