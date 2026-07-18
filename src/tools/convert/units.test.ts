import { describe, it, expect } from 'vitest';
import {
  convert, parseLocaleNumber, formatNumber, unitsOf, baseUnit, isUnit, CATEGORY_IDS,
} from './units';

describe('convert — length', () => {
  it('metric + imperial', () => {
    expect(convert('length', 'km', 'm', 1)).toBeCloseTo(1000, 9);
    expect(convert('length', 'mi', 'm', 1)).toBeCloseTo(1609.344, 9);
    expect(convert('length', 'in', 'cm', 1)).toBeCloseTo(2.54, 9);
    expect(convert('length', 'ft', 'in', 1)).toBeCloseTo(12, 9);
  });
  it('traditional KO/JA shaku·sun ≈ 30.3 / 3.03 cm', () => {
    expect(convert('length', 'shaku', 'cm', 1)).toBeCloseTo(30.3030, 3);
    expect(convert('length', 'sun', 'cm', 1)).toBeCloseTo(3.03030, 4);
  });
});

describe('convert — mass', () => {
  it('metric + imperial', () => {
    expect(convert('mass', 'kg', 'g', 1)).toBeCloseTo(1000, 9);
    expect(convert('mass', 'lb', 'g', 1)).toBeCloseTo(453.59237, 6);
    expect(convert('mass', 'st', 'lb', 1)).toBeCloseTo(14, 6);
  });
  it('traditional KO don/geun and JA kan/monme/kin', () => {
    expect(convert('mass', 'don', 'g', 1)).toBeCloseTo(3.75, 9);
    expect(convert('mass', 'geun', 'g', 1)).toBeCloseTo(600, 9);        // 근 (meat/general)
    expect(convert('mass', 'geun_produce', 'g', 1)).toBeCloseTo(375, 9); // 근 (produce)
    expect(convert('mass', 'kan', 'kg', 1)).toBeCloseTo(3.75, 9);
    expect(convert('mass', 'monme', 'g', 1)).toBeCloseTo(3.75, 9);
    expect(convert('mass', 'kin', 'g', 1)).toBeCloseTo(600, 9);
  });
  it('KO don ≡ JA monme, KO geun ≡ JA kin (same physical value)', () => {
    expect(convert('mass', 'don', 'monme', 1)).toBeCloseTo(1, 9);
    expect(convert('mass', 'geun', 'kin', 1)).toBeCloseTo(1, 9);
  });
});

describe('convert — temperature (affine, not scaled)', () => {
  it('°C ↔ °F', () => {
    expect(convert('temperature', 'c', 'f', 0)).toBeCloseTo(32, 9);
    expect(convert('temperature', 'c', 'f', 100)).toBeCloseTo(212, 9);
    expect(convert('temperature', 'f', 'c', 32)).toBeCloseTo(0, 9);
    expect(convert('temperature', 'c', 'f', -40)).toBeCloseTo(-40, 9); // the crossover point
  });
  it('°C ↔ K', () => {
    expect(convert('temperature', 'c', 'k', 0)).toBeCloseTo(273.15, 9);
    expect(convert('temperature', 'k', 'c', 273.15)).toBeCloseTo(0, 9);
  });
  it('round-trips F→C→F', () => {
    expect(convert('temperature', 'c', 'f', convert('temperature', 'f', 'c', 98.6))).toBeCloseTo(98.6, 9);
  });
});

describe('convert — area (incl. pyeong = tsubo = 400/121 m²)', () => {
  it('metric + imperial', () => {
    expect(convert('area', 'ha', 'm2', 1)).toBeCloseTo(10000, 9);
    expect(convert('area', 'acre', 'm2', 1)).toBeCloseTo(4046.8564224, 6);
  });
  it('pyeong/tsubo and jō', () => {
    expect(convert('area', 'pyeong', 'm2', 1)).toBeCloseTo(3.305785, 5);
    expect(convert('area', 'jo', 'm2', 1)).toBeCloseTo(1.652893, 5);
    expect(convert('area', 'jo', 'pyeong', 1)).toBeCloseTo(0.5, 9); // jō is exactly half a pyeong
    expect(convert('area', 'm2', 'pyeong', 1)).toBeCloseTo(0.3025, 9);
  });
});

describe('convert — volume (cooking cups differ by country)', () => {
  it('metric + imperial', () => {
    expect(convert('volume', 'l', 'ml', 1)).toBeCloseTo(1000, 9);
    expect(convert('volume', 'gal_us', 'l', 1)).toBeCloseTo(3.785411784, 9);
  });
  it('US legal 240 / metric 250 / Japan 200 mL cups', () => {
    expect(convert('volume', 'cup_us', 'ml', 1)).toBeCloseTo(240, 9);
    expect(convert('volume', 'cup_metric', 'ml', 1)).toBeCloseTo(250, 9);
    expect(convert('volume', 'cup_jp', 'ml', 1)).toBeCloseTo(200, 9);
  });
  it('JA shō/gō', () => {
    expect(convert('volume', 'sho', 'l', 1)).toBeCloseTo(1.8039, 3);
    expect(convert('volume', 'go', 'l', 1)).toBeCloseTo(0.18039, 4);
  });
});

describe('convert — speed / time / digital', () => {
  it('speed', () => {
    expect(convert('speed', 'kmh', 'mps', 1)).toBeCloseTo(0.277778, 5);
    expect(convert('speed', 'mph', 'kmh', 1)).toBeCloseTo(1.609344, 6);
    expect(convert('speed', 'knot', 'kmh', 1)).toBeCloseTo(1.852, 5);
  });
  it('time', () => {
    expect(convert('time', 'h', 's', 1)).toBeCloseTo(3600, 9);
    expect(convert('time', 'day', 'h', 1)).toBeCloseTo(24, 9);
  });
  it('digital SI vs IEC', () => {
    expect(convert('digital', 'kib', 'byte', 1)).toBeCloseTo(1024, 9);
    expect(convert('digital', 'mb', 'byte', 1)).toBeCloseTo(1e6, 3);
    expect(convert('digital', 'gib', 'mib', 1)).toBeCloseTo(1024, 9);
    expect(convert('digital', 'byte', 'bit', 1)).toBeCloseTo(8, 9);
  });
});

describe('convert — errors & round-trips', () => {
  it('throws on unknown unit (from or to)', () => {
    expect(() => convert('length', 'nope', 'm', 1)).toThrow(/unknown/);
    expect(() => convert('length', 'm', 'nope', 1)).toThrow(/unknown/);
  });
  it('inverse conversion returns the original', () => {
    const r = convert('mass', 'kg', 'lb', 5);
    expect(convert('mass', 'lb', 'kg', r)).toBeCloseTo(5, 9);
  });
  it('same unit is identity', () => {
    expect(convert('length', 'm', 'm', 42)).toBe(42);
  });
});

describe('parseLocaleNumber', () => {
  it('en: dot decimal, comma grouping', () => {
    expect(parseLocaleNumber('1,234.5', 'en-US')).toBeCloseTo(1234.5, 9);
    expect(parseLocaleNumber('1.5', 'en-US')).toBeCloseTo(1.5, 9);
    expect(parseLocaleNumber('-3.5', 'en-US')).toBeCloseTo(-3.5, 9);
    expect(parseLocaleNumber('42', 'en-US')).toBe(42);
  });
  it('de: comma decimal, dot grouping', () => {
    expect(parseLocaleNumber('1.234,5', 'de-DE')).toBeCloseTo(1234.5, 9);
    expect(parseLocaleNumber('1,5', 'de-DE')).toBeCloseTo(1.5, 9);
  });
  it('rejects empty/blank/garbage as null', () => {
    expect(parseLocaleNumber('', 'en-US')).toBeNull();
    expect(parseLocaleNumber('   ', 'en-US')).toBeNull();
    expect(parseLocaleNumber('abc', 'en-US')).toBeNull();
  });
});

describe('formatNumber', () => {
  it('localizes grouping and decimal', () => {
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
    expect(formatNumber(1.5, 'de-DE')).toBe('1,5');
  });
  it('empty string for non-finite', () => {
    expect(formatNumber(NaN, 'en-US')).toBe('');
    expect(formatNumber(Infinity, 'en-US')).toBe('');
  });
});

describe('catalog helpers', () => {
  it('every category has ≥2 units and a base unit that belongs to it', () => {
    for (const c of CATEGORY_IDS) {
      const units = unitsOf(c);
      expect(units.length).toBeGreaterThanOrEqual(2);
      expect(isUnit(c, baseUnit(c))).toBe(true);
    }
  });
  it('isUnit rejects foreign units', () => {
    expect(isUnit('length', 'kg')).toBe(false);
    expect(isUnit('temperature', 'c')).toBe(true);
  });
});
