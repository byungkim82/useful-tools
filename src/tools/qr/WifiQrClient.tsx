'use client';

import { useState } from 'react';
import type { Dictionary } from '@/i18n/dictionaries';
import QrCodeTool from './qr-core';
import { buildWifiPayload, type WifiEncryption } from './content-payloads';

type Props = { t: Dictionary['tools']['wifi-qr-code']; common: Dictionary['common']; locale: string };

const ENCRYPTIONS: WifiEncryption[] = ['WPA', 'WEP', 'nopass'];

export default function WifiQrClient({ t, common }: Props) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [encryption, setEncryption] = useState<WifiEncryption>('WPA');
  const [hidden, setHidden] = useState(false);

  // Empty until an SSID exists → the empty hint shows instead of an all-but-meaningless code.
  const text = ssid.trim() ? buildWifiPayload({ ssid, password, encryption, hidden }) : '';
  const encLabel = (e: WifiEncryption) => (e === 'WPA' ? t.encWpa : e === 'WEP' ? t.encWep : t.encNone);

  return (
    <QrCodeTool text={text} emptyHint={t.emptyHint} labels={t} common={common}>
      <label className="block">
        <span className="text-sm font-medium">{t.ssidLabel}</span>
        <input
          value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder={t.ssidPlaceholder}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">{t.encryptionLabel}</span>
        <select
          value={encryption} onChange={(e) => setEncryption(e.target.value as WifiEncryption)}
          className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {ENCRYPTIONS.map((e) => <option key={e} value={e}>{encLabel(e)}</option>)}
        </select>
      </label>

      {encryption !== 'nopass' && (
        <label className="block">
          <span className="text-sm font-medium">{t.passwordLabel}</span>
          <input
            value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.passwordPlaceholder}
            autoCapitalize="none" autoCorrect="off" spellCheck={false}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        {t.hiddenLabel}
      </label>
    </QrCodeTool>
  );
}
