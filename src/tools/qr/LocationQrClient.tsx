'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';
import { buildGeoPayload } from './content-payloads';

type Props = { t: Dictionary['tools']['location-qr-code']; common: Dictionary['common']; locale: string };

const INPUT = 'mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900';

export default function LocationQrClient({ t, common }: Props) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [label, setLabel] = useState('');
  const text = lat.trim() && lng.trim() ? buildGeoPayload({ lat, lng, label }) : '';
  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">{t.latLabel}</span>
          <input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="37.7749"
            autoCorrect="off" spellCheck={false} className={INPUT} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.lngLabel}</span>
          <input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-122.4194"
            autoCorrect="off" spellCheck={false} className={INPUT} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">{t.labelLabel}</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} />
      </label>
    </QrCodeTool>
  );
}
