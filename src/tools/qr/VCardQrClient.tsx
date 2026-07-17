'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';
import { buildVCardPayload, vcardHasData, type VCardInput } from './content-payloads';

type Props = { t: Dictionary['tools']['vcard-qr-code']; common: Dictionary['common']; locale: string };

const EMPTY: VCardInput = { firstName: '', lastName: '', phone: '', email: '', org: '', jobTitle: '', url: '' };

export default function VCardQrClient({ t, common }: Props) {
  const [v, setV] = useState<VCardInput>(EMPTY);
  const set = <K extends keyof VCardInput>(k: K, val: VCardInput[K]) => setV((prev) => ({ ...prev, [k]: val }));

  const text = vcardHasData(v) ? buildVCardPayload(v) : '';

  const field = (key: keyof VCardInput, label: string, type = 'text') => (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type} value={v[key]} onChange={(e) => set(key, e.target.value)}
        autoCapitalize={type === 'email' || type === 'url' ? 'none' : undefined}
        autoCorrect="off" spellCheck={false}
        className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
      />
    </label>
  );

  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <div className="grid grid-cols-2 gap-3">
        {field('firstName', t.firstNameLabel)}
        {field('lastName', t.lastNameLabel)}
      </div>
      {field('phone', t.phoneLabel, 'tel')}
      {field('email', t.emailLabel, 'email')}
      {field('org', t.orgLabel)}
      {field('jobTitle', t.jobTitleLabel)}
      {field('url', t.urlLabel, 'url')}
    </QrCodeTool>
  );
}
