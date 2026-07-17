import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import {
  toQrcodeOptions, isCapacityError, qrColorWarning, contrastRatio, QR_DEFAULTS, QR_LIMITS, isRenderable,
} from './qr-payload';

describe('isRenderable', () => {
  it('rejects empty/whitespace, accepts content', () => {
    expect(isRenderable('')).toBe(false);
    expect(isRenderable('   ')).toBe(false);
    expect(isRenderable('x')).toBe(true);
  });
});

describe('toQrcodeOptions', () => {
  it('clamps size/margin and falls back on invalid colors', () => {
    const o = toQrcodeOptions({ ...QR_DEFAULTS, size: 99999, margin: -5, fgColor: 'nope', bgColor: '#112233' });
    expect(o.width).toBe(QR_LIMITS.maxSize);
    expect(o.margin).toBe(QR_LIMITS.minMargin);
    expect(o.color.dark).toBe('#000000');
    expect(o.color.light).toBe('#112233');
  });
});

describe('isCapacityError (verifies the REAL coupling to qrcode)', () => {
  it('classifies an actual over-capacity error thrown by qrcode', async () => {
    let err: unknown;
    try {
      await QRCode.toString('a'.repeat(2000), { type: 'svg', errorCorrectionLevel: 'H' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(isCapacityError(err)).toBe(true); // breaks if qrcode ever changes its message → we WANT that
  });
  it('does not misclassify unrelated errors', () => {
    expect(isCapacityError(new Error('network glitch'))).toBe(false);
  });
});

describe('qrColorWarning (ratio + polarity)', () => {
  it('flags low contrast, inversion, and passes dark-on-light', () => {
    expect(qrColorWarning('#000000', '#ffffff')).toBeNull();
    expect(qrColorWarning('#dddddd', '#ffffff')).toBe('low-contrast');
    expect(qrColorWarning('#ffffff', '#000000')).toBe('inverted');
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(20);
  });
});
