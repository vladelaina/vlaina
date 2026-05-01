import { describe, expect, it } from 'vitest';
import { normalizeAuthError } from './authSupport';

describe('normalizeAuthError', () => {
  it('maps network failures to a user-facing offline message', () => {
    expect(normalizeAuthError('Unable to reach vlaina API: Failed to fetch')).toBe(
      'No internet connection. Please check your network and try again.'
    );
    expect(normalizeAuthError('NetworkError when attempting to fetch resource.')).toBe(
      'No internet connection. Please check your network and try again.'
    );
  });
});
