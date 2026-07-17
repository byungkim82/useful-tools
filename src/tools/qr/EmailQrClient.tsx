'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';
import { buildEmailPayload } from './content-payloads';

type Props = { t: Dictionary['tools']['email-qr-code']; common: Dictionary['common']; locale: string };

const INPUT = 'mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900';

export default function EmailQrClient({ t, common }: Props) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const text = to.trim() ? buildEmailPayload({ to, subject, body }) : '';
  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <label className="block">
        <span className="text-sm font-medium">{t.toLabel}</span>
        <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t.toPlaceholder}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} className={INPUT} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.subjectLabel}</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={INPUT} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.bodyLabel}</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={`${INPUT} resize-y`} />
      </label>
    </QrCodeTool>
  );
}
