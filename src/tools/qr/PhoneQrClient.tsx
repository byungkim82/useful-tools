'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';
import { buildPhonePayload } from './content-payloads';

type Props = { t: Dictionary['tools']['phone-qr-code']; common: Dictionary['common']; locale: string };

const INPUT = 'mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900';

export default function PhoneQrClient({ t, common }: Props) {
  const [phone, setPhone] = useState('');
  const text = phone.trim() ? buildPhonePayload(phone) : '';
  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <label className="block">
        <span className="text-sm font-medium">{t.phoneLabel}</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phonePlaceholder}
          autoCorrect="off" spellCheck={false} className={INPUT} />
      </label>
    </QrCodeTool>
  );
}
