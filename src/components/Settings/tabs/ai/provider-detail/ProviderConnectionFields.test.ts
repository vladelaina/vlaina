import { describe, expect, it } from 'vitest';
import { maskApiKey } from './ProviderConnectionFields';

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
