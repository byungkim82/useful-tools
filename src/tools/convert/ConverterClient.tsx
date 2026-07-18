'use client';

import type { ToolProps } from '@/tools/registry';
import Converter from './Converter';
import { categoryOfSlug } from './labels';

// One client component backing every converter category slug — it reads the slug (passed by ToolLoader)
// and renders the shared Converter for that category. Registered 8× in the registry, one per slug.
export default function ConverterClient({ slug, locale }: ToolProps) {
  const category = categoryOfSlug(slug);
  if (!category) return null;
  return <Converter category={category} locale={locale} />;
}
