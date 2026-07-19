'use client';

import type { ToolProps } from '@/tools/registry';
import { heicLabels } from './labels';
import { defaultFormatForSlug } from './compress-math';
import ImagePipelineClient from './ImagePipelineClient';

// Thin wrapper over the shared image pipeline: the HEIC converter with "convert" labels, a HEIC-only file
// filter, and the slug's default output format (heic-to-jpg → jpeg, heic-to-webp → webp). HEIC decoding
// needs a Worker + libheif; if the platform can't run it the pipeline surfaces labels.unsupported.
export default function HeicClient({ slug, locale }: ToolProps) {
  const labels = heicLabels(locale);
  return (
    <ImagePipelineClient
      labels={labels}
      accept=".heic,.heif,image/heic,image/heif"
      initialFormat={defaultFormatForSlug(slug)}
      unsupportedLabel={labels.unsupported}
    />
  );
}
