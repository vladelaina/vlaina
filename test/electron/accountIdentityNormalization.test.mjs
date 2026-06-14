import { describe, expect, it } from 'vitest';
import {
  normalizeDesktopAccountAvatarUrl,
  normalizeDesktopAccountEmail,
  normalizeDesktopAccountMembershipName,
  normalizeDesktopAccountUsername,
} from '../../electron/accountIdentityNormalization.mjs';

describe('desktop account identity normalization', () => {
  it('normalizes bounded identity strings', () => {
    expect(normalizeDesktopAccountUsername(' vla ')).toBe('vla');
    expect(normalizeDesktopAccountEmail(' vla@example.com ')).toBe('vla@example.com');
    expect(normalizeDesktopAccountMembershipName(' Pro ')).toBe('Pro');
  });

  it('rejects unsafe or oversized identity strings before trimming them', () => {
    expect(normalizeDesktopAccountUsername(`${' '.repeat(257)}vla`)).toBeNull();
    expect(normalizeDesktopAccountEmail('vla@example.com\u202E')).toBeNull();
    expect(normalizeDesktopAccountMembershipName('P'.repeat(129))).toBeNull();
  });

  it('keeps only public HTTP avatar URLs', () => {
    expect(normalizeDesktopAccountAvatarUrl(' https://example.com/avatar.png ')).toBe('https://example.com/avatar.png');
    expect(normalizeDesktopAccountAvatarUrl('http://127.0.0.1/avatar.png')).toBeNull();
    expect(normalizeDesktopAccountAvatarUrl('https://user:pass@example.com/avatar.png')).toBeNull();
    expect(normalizeDesktopAccountAvatarUrl(`${' '.repeat(4097)}https://example.com/avatar.png`)).toBeNull();
  });
});
