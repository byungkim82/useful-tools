import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { groupTools } from '@/tools/registry';

// Short, localized labels for the in-tool type switcher. Kept here (not in the per-tool dictionaries)
// so adding a QR type is one label line, not another 6-locale dictionary field. Server-rendered as
// real <a> links, so every QR page links to every other — internal linking + navigation for free.
const LABEL: Record<string, Partial<Record<Locale, string>>> = {
  'qr': { ko: 'URL·텍스트', en: 'URL / Text', es: 'URL / Texto', pt: 'URL / Texto', ja: 'URL・テキスト', de: 'URL / Text' },
  'wifi-qr-code': { ko: 'WiFi', en: 'WiFi', es: 'WiFi', pt: 'WiFi', ja: 'WiFi', de: 'WLAN' },
  'vcard-qr-code': { ko: 'vCard', en: 'vCard', es: 'vCard', pt: 'vCard', ja: 'vCard', de: 'vCard' },
  'email-qr-code': { ko: '이메일', en: 'Email', es: 'Email', pt: 'E-mail', ja: 'メール', de: 'E-Mail' },
  'sms-qr-code': { ko: 'SMS', en: 'SMS', es: 'SMS', pt: 'SMS', ja: 'SMS', de: 'SMS' },
  'phone-qr-code': { ko: '전화', en: 'Phone', es: 'Teléfono', pt: 'Telefone', ja: '電話', de: 'Telefon' },
  'whatsapp-qr-code': { ko: 'WhatsApp', en: 'WhatsApp', es: 'WhatsApp', pt: 'WhatsApp', ja: 'WhatsApp', de: 'WhatsApp' },
  'location-qr-code': { ko: '위치', en: 'Location', es: 'Ubicación', pt: 'Localização', ja: '位置情報', de: 'Standort' },
  'event-qr-code': { ko: '이벤트', en: 'Event', es: 'Evento', pt: 'Evento', ja: 'イベント', de: 'Termin' },
};

export default function QrTypeNav({ locale, current, group }: { locale: Locale; current: string; group: string }) {
  const items = groupTools(group);
  const label = (slug: string) => LABEL[slug]?.[locale] ?? slug;
  return (
    <nav aria-label="QR type" className="mt-4 flex flex-wrap gap-2">
      {items.map((t) =>
        t.slug === current ? (
          <span
            key={t.slug}
            aria-current="page"
            className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {label(t.slug)}
          </span>
        ) : (
          <Link
            key={t.slug}
            href={`/${locale}/tools/${t.slug}`}
            className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          >
            {label(t.slug)}
          </Link>
        ),
      )}
    </nav>
  );
}
