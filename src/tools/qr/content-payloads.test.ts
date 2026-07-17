import { describe, it, expect } from 'vitest';
import { buildWifiPayload, buildVCardPayload, vcardHasData } from './content-payloads';

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
