'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';

type Props = { t: Dictionary['tools']['qr']; common: Dictionary['common']; locale: string };

export default function QrToolClient({ t, common }: Props) {
  const [text, setText] = useState('');
  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <label className="block">
        <span className="text-sm font-medium">{t.inputLabel}</span>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} placeholder={t.inputPlaceholder}
          rows={3} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="mt-1 w-full resize-y rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
    </QrCodeTool>
  );
}
