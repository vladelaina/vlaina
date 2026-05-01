import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState, MembershipTier } from './state';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '@/lib/assets/avatarManager';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

export const AUTH_STATE_STORAGE_KEY = 'vlaina_auth_state';
export const AUTH_PROVIDER_STORAGE_KEY = 'vlaina_auth_provider';

function logAvatarStep(event: string, details: Record<string, unknown> = {}): void {
  if (import.meta.env.DEV) {
    console.info(`[account:avatar] ${event}`, details);
  }
}

function avatarHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return 'invalid';
  }
}

export function normalizeAuthError(raw: string): string {
  const message = raw.trim();
  if (!message) return 'Authorization failed';
  if (
    /unable to reach vlaina api|failed to fetch|networkerror|network request failed|fetch failed|load failed|err_internet_disconnected/i.test(
      message
    )
  ) {
    return 'No internet connection. Please check your network and try again.';
  }
  if (/session not found|missing session token|invalid session token/i.test(message)) {
    return 'Please sign in again';
  }
  if (/timed out/i.test(message)) {
    return 'Authorization timed out';
  }
  return message;
}

export function persistUser(data: {
  isConnected: boolean;
  provider: AccountProvider | null;
  username: string | null;
  primaryEmail: string | null;
  avatarUrl: string | null;
  membershipTier: MembershipTier | null;
  membershipName: string | null;
}) {
  localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify(data));
}

export function clearAuthIntent(): void {
  sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
}

export async function refreshAvatar(
  set: Set,
  get: Get,
  username: string | null,
  avatarUrl: string | null
) {
  const startedAt = performance.now();
  if (!username) {
    logAvatarStep('refresh:no_username');
    set({ localAvatarUrl: null });
    return;
  }

  const localSrc = await getLocalAvatarUrl(username);
  logAvatarStep('refresh:local_lookup_done', {
    username,
    hasLocalAvatar: !!localSrc,
    hasRemoteAvatar: typeof avatarUrl === 'string' && avatarUrl.trim().length > 0,
    remoteAvatarHost: avatarHost(avatarUrl),
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
  });
  set({ localAvatarUrl: localSrc || null });

  if (!avatarUrl) {
    logAvatarStep('refresh:no_remote_avatar', { username });
    return;
  }

  const downloadStartedAt = performance.now();
  downloadAndSaveAvatar(avatarUrl, username)
    .then(async () => {
      if (get().username !== username) {
        logAvatarStep('refresh:download_skipped_user_changed', { username });
        return;
      }
      const nextLocalSrc = await getLocalAvatarUrl(username);
      if (nextLocalSrc) {
        set({ localAvatarUrl: nextLocalSrc });
      }
      logAvatarStep('refresh:download_done', {
        username,
        saved: !!nextLocalSrc,
        durationMs: Math.max(0, Math.round(performance.now() - downloadStartedAt)),
      });
    })
    .catch((error: unknown) => {
      logAvatarStep('refresh:download_error', {
        username,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Math.max(0, Math.round(performance.now() - downloadStartedAt)),
      });
      if (import.meta.env.DEV) {
        console.warn('[authSupport] avatar download failed:', error);
      }
    });
}

export function isSessionConnected(get: Get): boolean {
  return get().isConnected === true;
}
