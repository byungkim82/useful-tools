'use client';

import type { ToolProps } from '@/tools/registry';
import type { Locale } from '@/i18n/config';
import { LABELS } from './labels';
import { defaultFormatForSlug } from './compress-math';
import ImagePipelineClient from './ImagePipelineClient';

// Thin wrapper over the shared image pipeline: the compressor with its own labels, an image/* file
// filter, and the slug's default output format (image-compressor → auto, compress-jpg → jpeg,
// compress-webp → webp). All the flow lives in ImagePipelineClient.
export default function ImageCompressorClient({ slug, locale }: ToolProps) {
  const labels = LABELS[locale as Locale] ?? LABELS.en;
  return <ImagePipelineClient labels={labels} accept="image/*" initialFormat={defaultFormatForSlug(slug)} />;
}
