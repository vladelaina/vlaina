import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState, MembershipTier } from './state';
import { ACCOUNT_USER_PERSIST_KEY } from './state';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '@/lib/assets/avatarManager';
import { normalizePublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { translate } from '@/lib/i18n';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

export const AUTH_STATE_STORAGE_KEY = 'vlaina_auth_state';
export const AUTH_PROVIDER_STORAGE_KEY = 'vlaina_auth_provider';
export const ACCOUNT_USER_BROADCAST_CHANNEL = 'vlaina_account_identity';
export const ACCOUNT_USER_BROADCAST_TYPE = 'account-identity-updated';
export const ACCOUNT_STATUS_REFRESH_KEY = 'vlaina_account_status_refresh';
const MAX_ACCOUNT_USER_STORAGE_CHARS = 64 * 1024;
const MAX_ACCOUNT_IDENTITY_NAME_CHARS = 256;
const MAX_ACCOUNT_IDENTITY_EMAIL_CHARS = 320;
const MAX_ACCOUNT_IDENTITY_AVATAR_URL_CHARS = 4096;
const MAX_ACCOUNT_IDENTITY_MEMBERSHIP_NAME_CHARS = 128;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export interface PersistedAccountIdentity {
  isConnected: boolean;
  provider: AccountProvider | null;
  username: string | null;
  primaryEmail: string | null;
  avatarUrl: string | null;
  membershipTier: MembershipTier | null;
  membershipName: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAccountIdentityString(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (value.length > maxChars) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars || CONTROL_OR_BIDI_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeAccountAvatarUrl(value: unknown): string | null {
  const trimmed = normalizeAccountIdentityString(value, MAX_ACCOUNT_IDENTITY_AVATAR_URL_CHARS);
  return trimmed ? normalizePublicRemoteMediaUrl(trimmed) : null;
}

export function normalizeAuthError(raw: string): string {
  let message = raw.trim();
  const ipcInvokeMatch = message.match(/^Error invoking remote method '[^']+':\s*(.+)$/i);
  if (ipcInvokeMatch?.[1]) {
    message = ipcInvokeMatch[1].trim();
  }
  if (/^incorrect verification code$/i.test(message)) {
    return translate('account.error.incorrectVerificationCode');
  }
  if (/^invalid email address$/i.test(message)) {
    return translate('account.error.invalidEmailAddress');
  }
  if (/^you are already signed in with this email$/i.test(message)) {
    return translate('account.error.alreadySignedInWithEmail');
  }
  if (/^failed to send verification code\b/i.test(message)) {
    return translate('account.error.sendVerificationCodeFailed');
  }
  if (/^web sign-in is unavailable on local development origins/i.test(message)) {
    return translate('account.error.webSignInUnavailable');
  }
  if (/^invalid verification code$/i.test(message)) {
    return translate('account.error.invalidVerificationCode');
  }
  if (
    /^failed to start account sign-in$/i.test(message) ||
    /^unable to store sign-in state in this browser session$/i.test(message) ||
    /^account sign-in (?:state|provider) mismatch$/i.test(message) ||
    /^unsupported (?:account|desktop) sign-in provider$/i.test(message) ||
    /^sign-in start response is missing auth url or state$/i.test(message) ||
    /^sign-in start response contains unsupported auth url$/i.test(message) ||
    /^oauth state mismatch$/i.test(message) ||
    /^(?:authorization|account sign-in) failed$/i.test(message)
  ) {
    return translate('account.error.loginFailed');
  }
  if (/^verification code expired\.? request a new code\.?$/i.test(message)) {
    return translate('account.error.expiredVerificationCode');
  }
  if (/^too many incorrect attempts\.? request a new code\.?$/i.test(message)) {
    return translate('account.error.tooManyVerificationAttempts');
  }
  if (!message) return translate('account.error.loginFailed');
  if (/^email sign-in failed$/i.test(message)) {
    return translate('account.error.emailSignInFailed');
  }
  if (/system secure storage is unavailable/i.test(message)) {
    return translate('account.error.secureStorageUnavailable');
  }
  if (
    /unable to reach vlaina api|failed to fetch|networkerror|network request failed|fetch failed|load failed|(?:net::)?err_[a-z_]+/i.test(
      message
    )
  ) {
    return translate('account.error.network');
  }
  if (/session not found|missing session token|invalid session token/i.test(message)) {
    return translate('account.error.signInAgain');
  }
  if (/timed out/i.test(message)) {
    return translate('account.error.timeout');
  }
  return message;
}

export function isEmailCodeRequestCooldownError(raw: string): boolean {
  let message = raw.trim();
  const ipcInvokeMatch = message.match(/^Error invoking remote method '[^']+':\s*(.+)$/i);
  if (ipcInvokeMatch?.[1]) {
    message = ipcInvokeMatch[1].trim();
  }

  return (
    /please wait.*before request/i.test(message) ||
    /wait before requesting/i.test(message) ||
    /too many.*(email|verification)?.*code.*request/i.test(message) ||
    /rate limit/i.test(message)
  );
}

function broadcastPersistedUser(data: PersistedAccountIdentity): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(ACCOUNT_USER_BROADCAST_CHANNEL);
    channel.postMessage({
      type: ACCOUNT_USER_BROADCAST_TYPE,
      identity: data,
    });
  } catch {
  } finally {
    channel?.close();
  }
}

export function normalizePersistedUser(value: unknown): Partial<AccountSessionState> {
  if (!isRecord(value)) {
    return {};
  }

  const parsed = value as Partial<AccountSessionState>;
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
    username: normalizeAccountIdentityString(parsed.username, MAX_ACCOUNT_IDENTITY_NAME_CHARS),
    primaryEmail: normalizeAccountIdentityString(parsed.primaryEmail, MAX_ACCOUNT_IDENTITY_EMAIL_CHARS),
    avatarUrl: normalizeAccountAvatarUrl(parsed.avatarUrl),
    membershipTier,
    membershipName: normalizeAccountIdentityString(
      parsed.membershipName,
      MAX_ACCOUNT_IDENTITY_MEMBERSHIP_NAME_CHARS,
    ),
  };
}

export function persistUser(data: PersistedAccountIdentity) {
  const normalized = {
    ...data,
    ...normalizePersistedUser(data),
  } satisfies PersistedAccountIdentity;
  try {
    localStorage.setItem(ACCOUNT_USER_PERSIST_KEY, JSON.stringify(normalized));
  } catch {
  }
  broadcastPersistedUser(normalized);
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
    if (raw.length > MAX_ACCOUNT_USER_STORAGE_CHARS) {
      return {};
    }

    return normalizePersistedUser(JSON.parse(raw));
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
    if (!get().username) {
      set({ localAvatarUrl: null });
    }
    return;
  }

  const localSrc = await getLocalAvatarUrl(username);
  if (get().username !== username) {
    return;
  }
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
      if (get().username === username && nextLocalSrc) {
        set({ localAvatarUrl: nextLocalSrc });
      }
    })
    .catch(() => {
    });
}

export function isSessionConnected(get: Get): boolean {
  return get().isConnected === true;
}
