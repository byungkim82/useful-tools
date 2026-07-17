'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';
import { buildEventPayload, eventHasData, type EventInput } from './content-payloads';

type Props = { t: Dictionary['tools']['event-qr-code']; common: Dictionary['common']; locale: string };

const EMPTY: EventInput = { title: '', location: '', description: '', start: '', end: '' };
const INPUT = 'mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900';

export default function EventQrClient({ t, common }: Props) {
  const [e, setE] = useState<EventInput>(EMPTY);
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setE((p) => ({ ...p, [k]: v }));
  const text = eventHasData(e) ? buildEventPayload(e) : '';
  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <label className="block">
        <span className="text-sm font-medium">{t.titleLabel}</span>
        <input value={e.title} onChange={(ev) => set('title', ev.target.value)} className={INPUT} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">{t.startLabel}</span>
          <input type="datetime-local" value={e.start} onChange={(ev) => set('start', ev.target.value)} className={INPUT} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">{t.endLabel}</span>
          <input type="datetime-local" value={e.end} onChange={(ev) => set('end', ev.target.value)} className={INPUT} />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium">{t.locationLabel}</span>
        <input value={e.location} onChange={(ev) => set('location', ev.target.value)} className={INPUT} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.descriptionLabel}</span>
        <textarea value={e.description} onChange={(ev) => set('description', ev.target.value)} rows={2} className={`${INPUT} resize-y`} />
      </label>
    </QrCodeTool>
  );
}
