// Pure payload builders for QR content types. Framework-free and unit-tested, like qr-payload.ts.
// Each "content type" is just a text encoding, so these run 100% client-side with no server.

export type WifiEncryption = 'WPA' | 'WEP' | 'nopass';

export type WifiInput = {
  ssid: string;
  password: string;
  encryption: WifiEncryption;
  hidden: boolean;
};

// WiFi QR format (de-facto standard): special chars \ ; , : " are backslash-escaped. A single
// left-to-right pass over the ORIGINAL string escapes a literal backslash correctly, without
// re-escaping the backslashes it just added.
const escWifi = (s: string): string => s.replace(/([\\;,:"])/g, '\\$1');

export function buildWifiPayload({ ssid, password, encryption, hidden }: WifiInput): string {
  const parts = [`T:${encryption}`, `S:${escWifi(ssid)}`];
  if (encryption !== 'nopass') parts.push(`P:${escWifi(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export type VCardInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  org: string;
  jobTitle: string;
  url: string;
};

// vCard 3.0 text values escape \ ; , and newlines. The structural ';' between N components is added
// AFTER escaping each component.
const escVCard = (s: string): string => s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');

export function buildVCardPayload(v: VCardInput): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escVCard(v.lastName.trim())};${escVCard(v.firstName.trim())};;;`);
  const fn = [v.firstName, v.lastName].map((s) => s.trim()).filter(Boolean).join(' ');
  if (fn) lines.push(`FN:${escVCard(fn)}`);
  if (v.org.trim()) lines.push(`ORG:${escVCard(v.org.trim())}`);
  if (v.jobTitle.trim()) lines.push(`TITLE:${escVCard(v.jobTitle.trim())}`);
  if (v.phone.trim()) lines.push(`TEL;TYPE=CELL:${v.phone.trim()}`);
  if (v.email.trim()) lines.push(`EMAIL:${v.email.trim()}`);
  if (v.url.trim()) lines.push(`URL:${v.url.trim()}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

export const vcardHasData = (v: VCardInput): boolean =>
  [v.firstName, v.lastName, v.phone, v.email, v.org, v.jobTitle, v.url].some((s) => s.trim().length > 0);

// --- Email (mailto, RFC 6068): subject/body are URL-encoded query params ---
export type EmailInput = { to: string; subject: string; body: string };
export function buildEmailPayload({ to, subject, body }: EmailInput): string {
  const params: string[] = [];
  if (subject.trim()) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body.trim()) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to.trim()}${params.length ? '?' + params.join('&') : ''}`;
}

// --- SMS (SMSTO — the most widely-supported variant) ---
export type SmsInput = { phone: string; message: string };
export function buildSmsPayload({ phone, message }: SmsInput): string {
  return message.trim() ? `SMSTO:${phone.trim()}:${message}` : `SMSTO:${phone.trim()}`;
}

// --- Phone (tel, RFC 3966) ---
export function buildPhonePayload(phone: string): string {
  return `tel:${phone.trim()}`;
}

// --- WhatsApp (wa.me): number must be digits only, text URL-encoded ---
export type WhatsAppInput = { phone: string; message: string };
export function buildWhatsAppPayload({ phone, message }: WhatsAppInput): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}${message.trim() ? '?text=' + encodeURIComponent(message) : ''}`;
}

// --- Geolocation (geo:, RFC 5870) ---
export type GeoInput = { lat: string; lng: string; label: string };
export function buildGeoPayload({ lat, lng, label }: GeoInput): string {
  const base = `geo:${lat.trim()},${lng.trim()}`;
  return label.trim() ? `${base}?q=${encodeURIComponent(label.trim())}` : base;
}

// --- Calendar event (iCalendar VEVENT, RFC 5545) ---
export type EventInput = { title: string; location: string; description: string; start: string; end: string };
const escICS = (s: string): string => s.replace(/([\\;,])/g, '\\$1').replace(/\n/g, '\\n');
// datetime-local "2026-09-01T09:00" → floating local iCal stamp "20260901T090000".
export function toICalDate(v: string): string {
  if (!v) return '';
  const [d, t = ''] = v.split('T');
  const date = d.replace(/-/g, '');
  const time = (t.replace(/:/g, '') + '000000').slice(0, 6);
  return `${date}T${time}`;
}
export function buildEventPayload({ title, location, description, start, end }: EventInput): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT'];
  if (title.trim()) lines.push(`SUMMARY:${escICS(title.trim())}`);
  const s = toICalDate(start), e = toICalDate(end);
  if (s) lines.push(`DTSTART:${s}`);
  if (e) lines.push(`DTEND:${e}`);
  if (location.trim()) lines.push(`LOCATION:${escICS(location.trim())}`);
  if (description.trim()) lines.push(`DESCRIPTION:${escICS(description.trim())}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\n');
}
export const eventHasData = (e: EventInput): boolean => e.title.trim().length > 0 || e.start.trim().length > 0;
