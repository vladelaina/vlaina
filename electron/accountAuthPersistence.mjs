import { resolveDesktopSessionToken } from './accountSessionAuth.mjs';
import { normalizeDesktopAccountProvider } from './accountCredentialStore.mjs';

export function createDesktopAuthPersistence({
  readDesktopSessionIdentity,
  writeStoredAccountCredentials,
}) {
  async function persistDesktopAuthResult(provider, result) {
    const appSessionToken = resolveDesktopSessionToken(result);
    const rawUsername =
      typeof result?.username === 'string' && result.username.trim() ? result.username.trim() : null;
    const rawPrimaryEmail =
      typeof result?.primaryEmail === 'string' && result.primaryEmail.trim()
        ? result.primaryEmail.trim()
        : null;
    const rawAvatarUrl =
      typeof result?.avatarUrl === 'string' && result.avatarUrl.trim() ? result.avatarUrl.trim() : null;

    if (!appSessionToken) {
      throw new Error('Account sign-in result missing session token');
    }

    const fallbackProvider =
      normalizeDesktopAccountProvider(result?.provider, null) ??
      provider;
    const fallbackUsername = rawUsername ?? rawPrimaryEmail ?? '';
    const fallbackPrimaryEmail = rawPrimaryEmail;
    const fallbackAvatarUrl = rawAvatarUrl;
    const authenticatedAt = Date.now();

    if (!fallbackUsername) {
      const sessionIdentity = await readDesktopSessionIdentity(appSessionToken).catch((error) => {
        return null;
      });
      const resolvedProvider =
        sessionIdentity?.provider ??
        fallbackProvider;
      const resolvedUsername = sessionIdentity?.username ?? fallbackUsername;
      const resolvedPrimaryEmail = sessionIdentity?.primaryEmail ?? fallbackPrimaryEmail;
      const resolvedAvatarUrl = sessionIdentity?.avatarUrl ?? fallbackAvatarUrl;
      const resolvedMembershipTier = sessionIdentity?.membershipTier ?? null;
      const resolvedMembershipName = sessionIdentity?.membershipName ?? null;

      if (!resolvedUsername) {
        throw new Error('Account sign-in completed but no desktop account identity could be resolved');
      }

      const credentials = {
        appSessionToken,
        provider: resolvedProvider,
        username: resolvedUsername,
        primaryEmail: resolvedPrimaryEmail,
        avatarUrl: resolvedAvatarUrl,
        membershipTier: resolvedMembershipTier,
        membershipName: resolvedMembershipName,
        authenticatedAt,
      };
      await writeStoredAccountCredentials(credentials);

      return {
        success: true,
        provider: resolvedProvider,
        username: resolvedUsername,
        primaryEmail: credentials.primaryEmail,
        avatarUrl: credentials.avatarUrl,
        membershipTier: credentials.membershipTier,
        membershipName: credentials.membershipName,
        error: null,
      };
    }

    const credentials = {
      appSessionToken,
      provider: fallbackProvider,
      username: fallbackUsername,
      primaryEmail: fallbackPrimaryEmail,
      avatarUrl: fallbackAvatarUrl,
      authenticatedAt,
    };
    await writeStoredAccountCredentials(credentials);

    return {
      success: true,
      provider: fallbackProvider,
      username: fallbackUsername,
      primaryEmail: credentials.primaryEmail,
      avatarUrl: credentials.avatarUrl,
      error: null,
    };
  }

  return {
    persistDesktopAuthResult,
  };
}
