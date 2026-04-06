import { describe, it, expect } from 'vitest';
import { isBase64, isUrl } from '@/lib/upload';

// ─── isBase64 ───

describe('isBase64', () => {
  it('returns true for data: URL', () => {
    expect(isBase64('data:image/png;base64,iVBOR...')).toBe(true);
  });

  it('returns false for http URL', () => {
    expect(isBase64('https://example.com/image.png')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isBase64('hello world')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isBase64('')).toBe(false);
  });
});

// ─── isUrl ───

describe('isUrl', () => {
  it('returns true for https URL', () => {
    expect(isUrl('https://example.com/image.png')).toBe(true);
  });

  it('returns true for http URL', () => {
    expect(isUrl('http://example.com')).toBe(true);
  });

  it('returns false for data: URL', () => {
    expect(isUrl('data:image/png;base64,abc')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isUrl('not-a-url')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isUrl('')).toBe(false);
  });
});
