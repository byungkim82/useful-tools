export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type QrOptions = {
  text: string;
  ecLevel: ErrorCorrectionLevel;
  size: number;
  margin: number;
  fgColor: string;
  bgColor: string;
};

export const QR_DEFAULTS: QrOptions = {
  text: '', ecLevel: 'M', size: 256, margin: 4, fgColor: '#000000', bgColor: '#ffffff',
};

export const QR_LIMITS = { minSize: 64, maxSize: 1024, minMargin: 0, maxMargin: 16 } as const;

const HEX6 = /^#[0-9a-fA-F]{6}$/;
export const isHexColor = (v: string): boolean => HEX6.test(v);
export const normalizeText = (text: string): string => text.trim();
// No fixed length cap: QR capacity is EC-dependent. Let qrcode reject over-capacity input and classify it.
export const isRenderable = (text: string): boolean => normalizeText(text).length > 0;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export function toQrcodeOptions(o: QrOptions) {
  return {
    errorCorrectionLevel: o.ecLevel,
    margin: clamp(Math.round(o.margin), QR_LIMITS.minMargin, QR_LIMITS.maxMargin),
    width: clamp(Math.round(o.size), QR_LIMITS.minSize, QR_LIMITS.maxSize),
    color: {
      dark: isHexColor(o.fgColor) ? o.fgColor : QR_DEFAULTS.fgColor,
      light: isHexColor(o.bgColor) ? o.bgColor : QR_DEFAULTS.bgColor,
    },
  };
}

// The ACTUAL failure path: qrcode throws when data exceeds the EC-level capacity.
export function isCapacityError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /too big|code length overflow|amount of data|data too long/i.test(msg);
}

function hexToRgb(hex: string): [number, number, number] {
  const int = HEX6.test(hex) ? parseInt(hex.slice(1), 16) : 0;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(hexToRgb(fg));
  const l2 = relativeLuminance(hexToRgb(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export type QrColorWarning = 'low-contrast' | 'inverted' | null;

// QR spec assumes DARK modules on LIGHT background. Check magnitude AND polarity.
export function qrColorWarning(fg: string, bg: string): QrColorWarning {
  if (contrastRatio(fg, bg) < 3) return 'low-contrast';
  if (relativeLuminance(hexToRgb(fg)) >= relativeLuminance(hexToRgb(bg))) return 'inverted';
  return null;
}
