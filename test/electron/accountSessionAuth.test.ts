import { describe, expect, it } from 'vitest';
import {
  buildDesktopSessionHeaders,
  desktopLegacySessionHeader,
  resolveDesktopSessionToken,
} from '../../electron/accountSessionAuth.mjs';

describe('desktop account session auth helpers', () => {
  it('prefers the desktop result sessionToken over legacy token fields', () => {
    expect(
      resolveDesktopSessionToken({
        sessionToken: 'nts_session',
        appSessionToken: 'ats_legacy',
        token: 'tok_fallback',
      }),
    ).toBe('nts_session');
  });

  it('falls back to legacy token fields when sessionToken is absent', () => {
    expect(
      resolveDesktopSessionToken({
        appSessionToken: 'ats_legacy',
        token: 'tok_fallback',
      }),
    ).toBe('ats_legacy');

    expect(
      resolveDesktopSessionToken({
        token: 'tok_fallback',
      }),
    ).toBe('tok_fallback');
  });

  it('builds bearer auth headers for desktop session requests', () => {
    expect(
      buildDesktopSessionHeaders('nts_session', {
        Accept: 'application/json',
      }),
    ).toEqual({
      Accept: 'application/json',
      [desktopLegacySessionHeader]: 'nts_session',
      Authorization: 'Bearer nts_session',
    });
  });

  it('keeps existing headers untouched when no session token exists', () => {
    expect(
      buildDesktopSessionHeaders('', {
        Accept: 'application/json',
      }),
    ).toEqual({
      Accept: 'application/json',
    });
  });
});
