export function buildDisconnectedDesktopStatus() {
  return {
    connected: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    membershipTier: null,
    membershipName: null,
  };
}

export function buildCachedDesktopStatus(credentials) {
  return {
    connected: true,
    provider: credentials.provider,
    username: credentials.username,
    primaryEmail: credentials.primaryEmail,
    avatarUrl: credentials.avatarUrl,
    membershipTier: null,
    membershipName: null,
  };
}

export function isDesktopSessionWithinGracePeriod(
  credentials,
  now = Date.now(),
  gracePeriodMs = 60_000,
) {
  const authenticatedAt =
    typeof credentials?.authenticatedAt === 'number' && Number.isFinite(credentials.authenticatedAt)
      ? credentials.authenticatedAt
      : null;

  if (authenticatedAt == null) {
    return false;
  }

  return now - authenticatedAt >= 0 && now - authenticatedAt <= gracePeriodMs;
}

export function resolveDesktopSessionProbe(credentials, probe) {
  if (!credentials) {
    return {
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: false,
    };
  }

  if (probe.kind === 'unauthorized') {
    return {
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: true,
    };
  }

  if (probe.kind === 'non_ok') {
    return {
      status: buildCachedDesktopStatus(credentials),
      nextCredentials: credentials,
      clearStoredCredentials: false,
    };
  }

  if (probe.kind === 'error') {
    return {
      status: buildCachedDesktopStatus(credentials),
      nextCredentials: credentials,
      clearStoredCredentials: false,
    };
  }

  if (probe.payload?.connected !== true) {
    return {
      status: buildDisconnectedDesktopStatus(),
      nextCredentials: null,
      clearStoredCredentials: true,
    };
  }

  const nextCredentials = {
    appSessionToken: probe.rotatedAppSessionToken ?? credentials.appSessionToken,
    provider:
      typeof probe.payload?.provider === 'string' && probe.payload.provider.trim()
        ? probe.payload.provider.trim()
        : credentials.provider,
    username:
      typeof probe.payload?.username === 'string' && probe.payload.username.trim()
        ? probe.payload.username.trim()
        : credentials.username,
    primaryEmail:
      typeof probe.payload?.primaryEmail === 'string'
        ? probe.payload.primaryEmail
        : credentials.primaryEmail,
    avatarUrl:
      typeof probe.payload?.avatarUrl === 'string'
        ? probe.payload.avatarUrl
        : credentials.avatarUrl,
  };

  return {
    status: {
      connected: true,
      provider: nextCredentials.provider,
      username: nextCredentials.username,
      primaryEmail: nextCredentials.primaryEmail,
      avatarUrl: nextCredentials.avatarUrl,
      membershipTier:
        probe.payload?.membershipTier === 'free' ||
        probe.payload?.membershipTier === 'plus' ||
        probe.payload?.membershipTier === 'pro' ||
        probe.payload?.membershipTier === 'max'
          ? probe.payload.membershipTier
          : null,
      membershipName:
        typeof probe.payload?.membershipName === 'string' ? probe.payload.membershipName : null,
    },
    nextCredentials,
    clearStoredCredentials: false,
  };
}
