import { describe, expect, it } from 'vitest';
import {
  buildCachedDesktopStatus,
  buildDisconnectedDesktopStatus,
  isDesktopSessionWithinGracePeriod,
  resolveDesktopSessionProbe,
} from '../../electron/accountSessionStatus.mjs';

const credentials = {
  appSessionToken: 'nts_example',
  provider: 'google',
  username: 'vladelaina',
  primaryEmail: 'vladelaina@gmail.com',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('desktop account session status resolution', () => {
  it('returns disconnected when no credentials exist', () => {
    expect(resolveDesktopSessionProbe(null, { kind: 'error' })).toEqual({
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: false,
    });
  });

  it('clears stored credentials when auth/session is unauthorized', () => {
    expect(resolveDesktopSessionProbe(credentials, { kind: 'unauthorized' })).toEqual({
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: true,
    });
  });

  it('keeps cached desktop identity when auth/session errors', () => {
    expect(resolveDesktopSessionProbe(credentials, { kind: 'error' })).toEqual({
      status: buildCachedDesktopStatus(credentials),
      nextCredentials: credentials,
      clearStoredCredentials: false,
    });
  });

  it('clears stored credentials only when the payload explicitly says disconnected', () => {
    expect(
      resolveDesktopSessionProbe(credentials, {
        kind: 'ok',
        payload: { connected: false },
      }),
    ).toEqual({
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: true,
    });
  });

  it('merges payload identity when auth/session resolves successfully', () => {
    expect(
      resolveDesktopSessionProbe(credentials, {
        kind: 'ok',
        rotatedAppSessionToken: 'nts_rotated',
        payload: {
          connected: true,
          provider: 'google',
          username: 'octocat',
          primaryEmail: 'octo@example.com',
          avatarUrl: 'https://example.com/next.png',
          membershipTier: 'pro',
          membershipName: 'Pro',
        },
      }),
    ).toEqual({
      status: {
        connected: true,
        provider: 'google',
        username: 'octocat',
        primaryEmail: 'octo@example.com',
        avatarUrl: 'https://example.com/next.png',
        membershipTier: 'pro',
        membershipName: 'Pro',
      },
      nextCredentials: {
        appSessionToken: 'nts_rotated',
        provider: 'google',
        username: 'octocat',
        primaryEmail: 'octo@example.com',
        avatarUrl: 'https://example.com/next.png',
      },
      clearStoredCredentials: false,
    });
  });

  it('treats recent desktop auth records as being within the activation grace period', () => {
    expect(
      isDesktopSessionWithinGracePeriod(
        {
          ...credentials,
          authenticatedAt: 1_000,
        },
        20_000,
        30_000,
      ),
    ).toBe(true);

    expect(
      isDesktopSessionWithinGracePeriod(
        {
          ...credentials,
          authenticatedAt: 1_000,
        },
        40_000,
        30_000,
      ),
    ).toBe(false);

    expect(isDesktopSessionWithinGracePeriod(credentials, 20_000, 30_000)).toBe(false);
  });
});
