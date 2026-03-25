import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState, MembershipTier } from './state';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '@/lib/assets/avatarManager';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

export const AUTH_STATE_STORAGE_KEY = 'vlaina_auth_state';
export const AUTH_PROVIDER_STORAGE_KEY = 'vlaina_auth_provider';

export function normalizeAuthError(raw: string): string {
  const message = raw.trim();
  if (!message) return 'Authorization failed';
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
    .catch(() => {});
}

export function isSessionConnected(get: Get): boolean {
  return get().isConnected === true;
}
