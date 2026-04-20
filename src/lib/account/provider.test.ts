import { describe, expect, it } from 'vitest';
import {
  getAccountProviderLabel,
  isOauthAccountProvider,
  normalizeAccountProvider,
} from './provider';

describe('account provider helpers', () => {
  it('returns stable labels for supported providers', () => {
    expect(getAccountProviderLabel('github')).toBe('GitHub');
    expect(getAccountProviderLabel('google')).toBe('Google');
    expect(getAccountProviderLabel('email')).toBe('Email');
    expect(getAccountProviderLabel(null)).toBe('Account');
  });

  it('normalizes only supported providers', () => {
    expect(normalizeAccountProvider('github')).toBe('github');
    expect(normalizeAccountProvider('google')).toBe('google');
    expect(normalizeAccountProvider('email')).toBe('email');
    expect(normalizeAccountProvider('discord')).toBeNull();
    expect(normalizeAccountProvider(null)).toBeNull();
  });

  it('identifies oauth providers correctly', () => {
    expect(isOauthAccountProvider('github')).toBe(true);
    expect(isOauthAccountProvider('google')).toBe(true);
    expect(isOauthAccountProvider('email')).toBe(false);
  });
});
