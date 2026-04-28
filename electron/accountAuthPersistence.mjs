import { summarizeAuthResultShape } from './accountAuthDebug.mjs';
import { resolveDesktopSessionToken } from './accountSessionAuth.mjs';
import { normalizeDesktopAccountProvider } from './accountCredentialStore.mjs';

export function createDesktopAuthPersistence({
  logDesktopAuth,
  readDesktopSessionIdentity,
  readStoredAccountCredentials,
  writeStoredAccountCredentials,
}) {
  async function persistDesktopAuthResult(provider, result) {
    logDesktopAuth('persist_auth_result:start', { provider, result });
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
      logDesktopAuth('persist_auth_result:missing_token', { provider, result });
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
        logDesktopAuth('persist_auth_result:session_identity_error', {
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      });
      const resolvedProvider =
        sessionIdentity?.provider ??
        fallbackProvider;
      const resolvedUsername = sessionIdentity?.username ?? fallbackUsername;
      const resolvedPrimaryEmail = sessionIdentity?.primaryEmail ?? fallbackPrimaryEmail;
      const resolvedAvatarUrl = sessionIdentity?.avatarUrl ?? fallbackAvatarUrl;

      if (!resolvedUsername) {
        logDesktopAuth('persist_auth_result:missing_identity', {
          provider,
          result,
          sessionIdentity,
          resolvedProvider,
          resolvedPrimaryEmail,
          resolvedAvatarUrl,
        });
        throw new Error('Account sign-in completed but no desktop account identity could be resolved');
      }

      const credentials = {
        appSessionToken,
        provider: resolvedProvider,
        username: resolvedUsername,
        primaryEmail: resolvedPrimaryEmail,
        avatarUrl: resolvedAvatarUrl,
        authenticatedAt,
      };
      await writeStoredAccountCredentials(credentials);

      logDesktopAuth('persist_auth_result:done', {
        provider,
        result: summarizeAuthResultShape(result),
        sessionIdentity,
        credentials: {
          provider: credentials.provider,
          username: credentials.username,
          primaryEmail: credentials.primaryEmail,
          avatarUrl: credentials.avatarUrl,
          appSessionToken: credentials.appSessionToken,
          authenticatedAt: credentials.authenticatedAt,
        },
      });

      return {
        success: true,
        provider: resolvedProvider,
        username: resolvedUsername,
        primaryEmail: credentials.primaryEmail,
        avatarUrl: credentials.avatarUrl,
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

    void readDesktopSessionIdentity(appSessionToken)
      .then(async (sessionIdentity) => {
        if (!sessionIdentity) {
          logDesktopAuth('persist_auth_result:session_identity_deferred_unavailable', {
            provider,
            appSessionToken,
          });
          return;
        }

        const currentCredentials = await readStoredAccountCredentials();
        if (!currentCredentials || currentCredentials.appSessionToken !== appSessionToken) {
          logDesktopAuth('persist_auth_result:session_identity_deferred_skipped', {
            provider,
            appSessionToken,
          });
          return;
        }

        const nextCredentials = {
          ...currentCredentials,
          provider: sessionIdentity.provider ?? currentCredentials.provider,
          username: sessionIdentity.username ?? currentCredentials.username,
          primaryEmail: sessionIdentity.primaryEmail ?? currentCredentials.primaryEmail,
          avatarUrl: sessionIdentity.avatarUrl ?? currentCredentials.avatarUrl,
        };
        await writeStoredAccountCredentials(nextCredentials);
        logDesktopAuth('persist_auth_result:session_identity_deferred_applied', {
          provider,
          sessionIdentity,
          credentials: nextCredentials,
        });
      })
      .catch((error) => {
        logDesktopAuth('persist_auth_result:session_identity_deferred_error', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    logDesktopAuth('persist_auth_result:done', {
      provider,
      result: summarizeAuthResultShape(result),
      sessionIdentity: null,
      credentials: {
        provider: credentials.provider,
        username: credentials.username,
        primaryEmail: credentials.primaryEmail,
        avatarUrl: credentials.avatarUrl,
        appSessionToken: credentials.appSessionToken,
        authenticatedAt: credentials.authenticatedAt,
      },
    });

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
