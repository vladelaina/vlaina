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

const recentlyAuthenticatedCredentials = {
  ...credentials,
  authenticatedAt: 1_000,
};

describe('desktop account session status resolution', () => {
  it('returns disconnected when no credentials exist', () => {
    expect(resolveDesktopSessionProbe(null, { kind: 'error' })).toEqual({
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: false,
    });
  });

  it('keeps cached credentials when auth/session is unauthorized', () => {
    expect(resolveDesktopSessionProbe(credentials, { kind: 'unauthorized' })).toEqual({
      status: buildCachedDesktopStatus(credentials),
      nextCredentials: credentials,
      clearStoredCredentials: false,
    });
  });

  it('keeps cached desktop identity when auth/session errors', () => {
    expect(resolveDesktopSessionProbe(credentials, { kind: 'error' })).toEqual({
      status: buildCachedDesktopStatus(credentials),
      nextCredentials: credentials,
      clearStoredCredentials: false,
    });
  });

  it('keeps cached credentials when the payload says disconnected', () => {
    expect(
      resolveDesktopSessionProbe(credentials, {
        kind: 'ok',
        payload: { connected: false },
      }),
    ).toEqual({
      status: buildCachedDesktopStatus(credentials),
      nextCredentials: credentials,
      clearStoredCredentials: false,
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
        authenticatedAt: null,
      },
      clearStoredCredentials: false,
    });
  });

  it('preserves authenticatedAt when auth/session refreshes stored credentials', () => {
    const resolved = resolveDesktopSessionProbe(recentlyAuthenticatedCredentials, {
      kind: 'ok',
      payload: {
        connected: true,
        username: 'vladelaina',
      },
    });

    expect(resolved.nextCredentials?.authenticatedAt).toBe(1_000);
    expect(isDesktopSessionWithinGracePeriod(resolved.nextCredentials, 20_000, 30_000)).toBe(true);
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
