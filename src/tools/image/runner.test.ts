import { describe, it, expect } from 'vitest';
import { isHeic } from './runner';

describe('isHeic', () => {
  it('matches HEIC/HEIF MIME types (case-insensitive)', () => {
    expect(isHeic({ type: 'image/heic' })).toBe(true);
    expect(isHeic({ type: 'image/heif' })).toBe(true);
    expect(isHeic({ type: 'image/heic-sequence' })).toBe(true);
    expect(isHeic({ type: 'image/heif-sequence' })).toBe(true);
    expect(isHeic({ type: 'IMAGE/HEIC' })).toBe(true);
  });
  it('falls back to the extension only when the MIME type is empty', () => {
    expect(isHeic({ type: '', name: 'photo.heic' })).toBe(true);
    expect(isHeic({ type: '', name: 'photo.HEIF' })).toBe(true);
    expect(isHeic({ type: '', name: 'IMG_1234.heic' })).toBe(true);
    expect(isHeic({ type: '', name: 'photo.jpg' })).toBe(false);
    expect(isHeic({ type: '', name: 'noext' })).toBe(false);
    expect(isHeic({ type: '' })).toBe(false);
  });
  it('trusts a non-empty MIME type over a misleading extension', () => {
    // A real image with a .heic name but a decodable type should NOT be sent to the HEIC decoder.
    expect(isHeic({ type: 'image/png', name: 'weird.heic' })).toBe(false);
    expect(isHeic({ type: 'image/jpeg' })).toBe(false);
    expect(isHeic({ type: 'image/webp' })).toBe(false);
  });
});
