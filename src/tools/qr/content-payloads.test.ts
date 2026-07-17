import { describe, it, expect } from 'vitest';
import {
  buildWifiPayload, buildVCardPayload, vcardHasData,
  buildEmailPayload, buildSmsPayload, buildPhonePayload, buildWhatsAppPayload, buildGeoPayload,
  buildEventPayload, toICalDate,
} from './content-payloads';

describe('buildWifiPayload', () => {
  it('builds a standard WPA payload ending in ;;', () => {
    expect(buildWifiPayload({ ssid: 'MyNet', password: 'pw', encryption: 'WPA', hidden: false }))
      .toBe('WIFI:T:WPA;S:MyNet;P:pw;;');
  });
  it('omits the password and adds H:true for an open + hidden network', () => {
    expect(buildWifiPayload({ ssid: 'Open', password: 'ignored', encryption: 'nopass', hidden: true }))
      .toBe('WIFI:T:nopass;S:Open;H:true;;');
  });
  it('escapes special characters in ssid and password', () => {
    expect(buildWifiPayload({ ssid: 'My;Net', password: 'p:w"d', encryption: 'WPA', hidden: false }))
      .toBe('WIFI:T:WPA;S:My\\;Net;P:p\\:w\\"d;;');
  });
  it('escapes a literal backslash without double-escaping', () => {
    expect(buildWifiPayload({ ssid: 'a\\b', password: '', encryption: 'nopass', hidden: false }))
      .toBe('WIFI:T:nopass;S:a\\\\b;;');
  });
});

describe('buildVCardPayload', () => {
  it('wraps fields in a vCard 3.0 envelope and omits empty ones', () => {
    const out = buildVCardPayload({ firstName: 'Ada', lastName: 'Lovelace', phone: '+15551234567', email: '', org: '', jobTitle: '', url: '' });
    expect(out.startsWith('BEGIN:VCARD\nVERSION:3.0')).toBe(true);
    expect(out).toContain('N:Lovelace;Ada;;;');
    expect(out).toContain('FN:Ada Lovelace');
    expect(out).toContain('TEL;TYPE=CELL:+15551234567');
    expect(out).not.toContain('EMAIL:');
    expect(out.endsWith('END:VCARD')).toBe(true);
  });
  it('escapes ; and , in text fields', () => {
    const out = buildVCardPayload({ firstName: 'A', lastName: 'B;C', phone: '', email: '', org: 'X, Inc', jobTitle: '', url: '' });
    expect(out).toContain('N:B\\;C;A;;;');
    expect(out).toContain('ORG:X\\, Inc');
  });
});

describe('vcardHasData', () => {
  it('is false only when every field is blank', () => {
    const blank = { firstName: '', lastName: '', phone: '', email: '', org: '', jobTitle: '', url: '' };
    expect(vcardHasData(blank)).toBe(false);
    expect(vcardHasData({ ...blank, email: 'a@b.com' })).toBe(true);
  });
});

describe('buildEmailPayload', () => {
  it('emits a bare mailto when only a recipient is given', () => {
    expect(buildEmailPayload({ to: 'a@b.com', subject: '', body: '' })).toBe('mailto:a@b.com');
  });
  it('URL-encodes subject and body params', () => {
    expect(buildEmailPayload({ to: 'a@b.com', subject: 'Hi there', body: 'A & B' }))
      .toBe('mailto:a@b.com?subject=Hi%20there&body=A%20%26%20B');
  });
});

describe('buildSmsPayload / buildPhonePayload', () => {
  it('builds SMSTO with and without a message', () => {
    expect(buildSmsPayload({ phone: '+15551234567', message: 'Hello' })).toBe('SMSTO:+15551234567:Hello');
    expect(buildSmsPayload({ phone: '+15551234567', message: '' })).toBe('SMSTO:+15551234567');
  });
  it('builds a tel: URI', () => {
    expect(buildPhonePayload(' +1 555 123 ')).toBe('tel:+1 555 123');
  });
});

describe('buildWhatsAppPayload', () => {
  it('strips non-digits and encodes the message', () => {
    expect(buildWhatsAppPayload({ phone: '+1 (555) 123-4567', message: 'hi & bye' }))
      .toBe('https://wa.me/15551234567?text=hi%20%26%20bye');
  });
  it('omits the text param when no message', () => {
    expect(buildWhatsAppPayload({ phone: '15551234567', message: '' })).toBe('https://wa.me/15551234567');
  });
});

describe('buildGeoPayload', () => {
  it('builds geo: with an optional labelled query', () => {
    expect(buildGeoPayload({ lat: '37.7749', lng: '-122.4194', label: '' })).toBe('geo:37.7749,-122.4194');
    expect(buildGeoPayload({ lat: '37.7749', lng: '-122.4194', label: 'SF Office' }))
      .toBe('geo:37.7749,-122.4194?q=SF%20Office');
  });
});

describe('buildEventPayload / toICalDate', () => {
  it('converts a datetime-local value to a floating iCal stamp', () => {
    expect(toICalDate('2026-09-01T09:00')).toBe('20260901T090000');
    expect(toICalDate('')).toBe('');
  });
  it('wraps fields in a VCALENDAR/VEVENT envelope, omitting empty ones, and escapes text', () => {
    const out = buildEventPayload({
      title: 'Launch, v2', location: '', description: '', start: '2026-09-01T09:00', end: '2026-09-01T10:00',
    });
    expect(out.startsWith('BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT')).toBe(true);
    expect(out).toContain('SUMMARY:Launch\\, v2');
    expect(out).toContain('DTSTART:20260901T090000');
    expect(out).toContain('DTEND:20260901T100000');
    expect(out).not.toContain('LOCATION:');
    expect(out.endsWith('END:VEVENT\nEND:VCALENDAR')).toBe(true);
  });
});
