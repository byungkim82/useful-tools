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
