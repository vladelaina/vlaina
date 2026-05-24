import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState, MembershipTier } from './state';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '@/lib/assets/avatarManager';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

export const AUTH_STATE_STORAGE_KEY = 'vlaina_auth_state';
export const AUTH_PROVIDER_STORAGE_KEY = 'vlaina_auth_provider';
export const ACCOUNT_STATUS_REFRESH_KEY = 'vlaina_account_status_refresh';

export function normalizeAuthError(raw: string): string {
  const message = raw.trim();
  if (!message) return 'Authorization failed';
  if (/system secure storage is unavailable/i.test(message)) {
    return 'Unable to securely save your sign-in on this system. Please enable your system keyring and try again.';
  }
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
  try {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify(data));
  } catch {
  }
}

export function clearPersistedUser() {
  try {
    localStorage.removeItem(ACCOUNT_USER_PERSIST_KEY);
  } catch {
  }
}

export function broadcastAccountStatusRefresh() {
  try {
    localStorage.setItem(ACCOUNT_STATUS_REFRESH_KEY, String(Date.now()));
    localStorage.removeItem(ACCOUNT_STATUS_REFRESH_KEY);
  } catch {
  }
}

export function loadPersistedUser(): Partial<AccountSessionState> {
  try {
    const raw = localStorage.getItem(ACCOUNT_USER_PERSIST_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Partial<AccountSessionState>;
    const provider = parsed.provider === 'google' || parsed.provider === 'email'
      ? parsed.provider
      : null;
    const membershipTier =
      parsed.membershipTier === 'free' ||
      parsed.membershipTier === 'plus' ||
      parsed.membershipTier === 'pro' ||
      parsed.membershipTier === 'max' ||
      parsed.membershipTier === 'ultra'
        ? parsed.membershipTier
        : null;

    return {
      isConnected: parsed.isConnected === true,
      provider,
      username: typeof parsed.username === 'string' ? parsed.username : null,
      primaryEmail: typeof parsed.primaryEmail === 'string' ? parsed.primaryEmail : null,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
      membershipTier,
      membershipName: typeof parsed.membershipName === 'string' ? parsed.membershipName : null,
    };
  } catch {
    return {};
  }
}

export function clearAuthIntent(): void {
  try {
    sessionStorage.removeItem(AUTH_STATE_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY);
  } catch {
  }
}

export async function refreshAvatar(
  set: Set,
  get: Get,
  username: string | null,
  avatarUrl: string | null
) {
  if (!username) {
    set({ localAvatarUrl: null });
    return;
  }

  const localSrc = await getLocalAvatarUrl(username);
  set({ localAvatarUrl: localSrc || null });

  if (!avatarUrl) {
    return;
  }

  downloadAndSaveAvatar(avatarUrl, username)
    .then(async () => {
      if (get().username !== username) {
        return;
      }
      const nextLocalSrc = await getLocalAvatarUrl(username);
      if (nextLocalSrc) {
        set({ localAvatarUrl: nextLocalSrc });
      }
    })
    .catch(() => {
    });
}

export function isSessionConnected(get: Get): boolean {
  return get().isConnected === true;
}
