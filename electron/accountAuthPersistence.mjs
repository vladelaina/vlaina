import { summarizeAuthResultShape } from './accountAuthDebug.mjs';
import { resolveDesktopSessionToken } from './accountSessionAuth.mjs';
import { normalizeDesktopAccountProvider } from './accountCredentialStore.mjs';

function elapsedSince(startedAt) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export function createDesktopAuthPersistence({
  logDesktopAuth,
  readDesktopSessionIdentity,
  readStoredAccountCredentials,
  writeStoredAccountCredentials,
}) {
  async function persistDesktopAuthResult(provider, result) {
    const startedAt = performance.now();
    logDesktopAuth('persist_auth_result:start', {
      provider,
      result: summarizeAuthResultShape(result),
    });
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
      const identityStartedAt = performance.now();
      const sessionIdentity = await readDesktopSessionIdentity(appSessionToken).catch((error) => {
        logDesktopAuth('persist_auth_result:session_identity_error', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: elapsedSince(identityStartedAt),
        });
        return null;
      });
      logDesktopAuth('persist_auth_result:session_identity_inline_done', {
        hasIdentity: !!sessionIdentity,
        hasAvatarUrl: typeof sessionIdentity?.avatarUrl === 'string' && sessionIdentity.avatarUrl.trim().length > 0,
        durationMs: elapsedSince(identityStartedAt),
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
        durationMs: elapsedSince(startedAt),
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

    const deferredStartedAt = performance.now();
    void readDesktopSessionIdentity(appSessionToken)
      .then(async (sessionIdentity) => {
        if (!sessionIdentity) {
          logDesktopAuth('persist_auth_result:session_identity_deferred_unavailable', {
            provider,
            appSessionToken,
            durationMs: elapsedSince(deferredStartedAt),
          });
          return;
        }

        const currentCredentials = await readStoredAccountCredentials();
        if (!currentCredentials || currentCredentials.appSessionToken !== appSessionToken) {
          logDesktopAuth('persist_auth_result:session_identity_deferred_skipped', {
            provider,
            appSessionToken,
            durationMs: elapsedSince(deferredStartedAt),
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
          hasAvatarUrl: typeof nextCredentials.avatarUrl === 'string' && nextCredentials.avatarUrl.trim().length > 0,
          durationMs: elapsedSince(deferredStartedAt),
        });
      })
      .catch((error) => {
        logDesktopAuth('persist_auth_result:session_identity_deferred_error', {
          error: error instanceof Error ? error.message : String(error),
          durationMs: elapsedSince(deferredStartedAt),
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
      hasAvatarUrl: typeof credentials.avatarUrl === 'string' && credentials.avatarUrl.trim().length > 0,
      durationMs: elapsedSince(startedAt),
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
