'use client';

import dynamic from 'next/dynamic';
import { createContext, useContext, type ComponentType } from 'react';
import { tools, type ToolProps } from '@/tools/registry';

// The module-scope loading fallback can't take props, so the localized label arrives via context.
const LoadingLabelContext = createContext('');

function Spinner() {
  const label = useContext(LoadingLabelContext);
  return (
    <div className="flex items-center justify-center gap-2 py-8" role="status">
      <span
        aria-hidden="true"
        className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800 dark:border-neutral-700 dark:border-t-neutral-200"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// Module scope: next/dynamic({ssr:false}) is statically analyzable here, so the tool's DOM is kept
// OUT of the static HTML (verified) and code-split into its own chunk; only the Spinner is SSR'd.
// One documented cast: contravariance at the dynamic-dispatch boundary — the registry's mapped type
// already guarantees each load() matches its own slug's slice.
const loaders: Record<string, ComponentType<ToolProps>> = Object.fromEntries(
  tools.map((t) => [t.slug, dynamic(t.load as never, { ssr: false, loading: () => <Spinner /> })]),
);

export default function ToolLoader({ slug, t, common, locale }: { slug: string } & ToolProps) {
  const Tool = loaders[slug];
  if (!Tool) return null;
  return (
    <LoadingLabelContext.Provider value={common.loading}>
      <Tool t={t} common={common} locale={locale} />
    </LoadingLabelContext.Provider>
  );
}
