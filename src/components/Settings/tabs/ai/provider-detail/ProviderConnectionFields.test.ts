import { describe, expect, it } from 'vitest';
import { getApiKeyEditableSelectionRange, getApiKeyInputStyle, maskApiKey } from './ProviderConnectionFields';

describe('maskApiKey', () => {
  it('shows the first 7 and last 4 characters for long keys', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1234••••••cdef');
  });

  it('shows only the last 4 characters for short keys', () => {
    expect(maskApiKey('sk-123')).toBe('-123');
  });

  it('keeps an empty key empty', () => {
    expect(maskApiKey('')).toBe('');
  });
});

describe('getApiKeyInputStyle', () => {
  it('uses the standard size for typical keys', () => {
    expect(getApiKeyInputStyle('sk-1234567890abcdef')).toEqual({ fontSize: 14 });
  });

  it('scales down as keys get longer', () => {
    expect(getApiKeyInputStyle('k'.repeat(64))).toEqual({ fontSize: 12 });
    expect(getApiKeyInputStyle('k'.repeat(96))).toEqual({ fontSize: 12 });
    expect(getApiKeyInputStyle('k'.repeat(140))).toEqual({ fontSize: 12 });
  });

  it('uses the measured text width when provided', () => {
    expect(getApiKeyInputStyle('k'.repeat(64), 300)).toEqual({ fontSize: 12 });
  });

  it('keeps an empty key at the standard size', () => {
    expect(getApiKeyInputStyle('')).toEqual({ fontSize: 14 });
  });
});

describe('getApiKeyEditableSelectionRange', () => {
  it('selects the body after the sk- prefix', () => {
    expect(getApiKeyEditableSelectionRange('sk-1234567890abcdef')).toEqual({
      start: 3,
      end: 'sk-1234567890abcdef'.length,
    });
  });

  it('selects the whole key when there is no sk- prefix', () => {
    expect(getApiKeyEditableSelectionRange('provider-key')).toEqual({
      start: 0,
      end: 'provider-key'.length,
    });
  });
});
