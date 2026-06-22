import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState } from './state';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { accountCommands } from '@/lib/account/desktopCommands';
import { normalizeManagedBudgetPayload } from '@/lib/ai/managed/normalizers';
import { webAccountCommands, handleAuthCallback as parseAuthCallback } from '@/lib/account/webCommands';
import { isOauthAccountProvider, normalizeAccountProvider } from '@/lib/account/provider';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { normalizeExternalHref } from '@/lib/navigation/externalLinks';
import {
  AUTH_PROVIDER_STORAGE_KEY,
  AUTH_STATE_STORAGE_KEY,
  broadcastAccountStatusRefresh,
  clearPersistedUser,
  clearAuthIntent,
  isEmailCodeRequestCooldownError,
  normalizeAuthError,
  normalizePersistedUser,
  persistUser,
  refreshAvatar,
} from './authSupport';
import { applyDisconnectedAccount } from './sessionState';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

let checkStatusPromise: Promise<void> | null = null;
let checkStatusPromiseVersion = 0;
let accountSessionMutationVersion = 0;
let accountAuthAttemptVersion = 0;
let lastCheckStatusSyncAt = 0;

const ACCOUNT_STATUS_REFRESH_INTERVAL_MS = 30_000;
const MAX_AUTH_INTENT_STORAGE_CHARS = 4096;
const MAX_ACCOUNT_EMAIL_INPUT_CHARS = 4096;
const MAX_ACCOUNT_EMAIL_CHARS = 320;
const MAX_ACCOUNT_EMAIL_CODE_INPUT_CHARS = 64;
const AUTH_REDIRECT_UNSAFE_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const EMAIL_CODE_PATTERN = /^\d{6}$/;

function invalidateAccountSessionChecks(): void {
  accountSessionMutationVersion += 1;
  checkStatusPromise = null;
}

function startAccountAuthAttempt(): number {
  accountAuthAttemptVersion += 1;
  invalidateAccountSessionChecks();
  return accountAuthAttemptVersion;
}

function invalidateAccountAuthAttempts(): void {
  accountAuthAttemptVersion += 1;
  invalidateAccountSessionChecks();
}

export function invalidateAccountSessionAuthState(): void {
  invalidateAccountAuthAttempts();
}

function isCurrentAccountAuthAttempt(version: number): boolean {
  return version === accountAuthAttemptVersion;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmailInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ACCOUNT_EMAIL_INPUT_CHARS) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized.length <= MAX_ACCOUNT_EMAIL_CHARS && isValidEmail(normalized)
    ? normalized
    : null;
}

function normalizeEmailCodeInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ACCOUNT_EMAIL_CODE_INPUT_CHARS) {
    return null;
  }

  const normalized = value.trim();
  return EMAIL_CODE_PATTERN.test(normalized) ? normalized : null;
}

function isAuthorizationCancellation(message: string): boolean {
  return /^(?:authorization )?(?:cancelled|canceled)$/i.test(message.trim())
    || /^access_denied$/i.test(message.trim());
}

function readStoredAuthIntentValue(key: string): string | null {
  try {
    const value = sessionStorage.getItem(key);
    return value && value.length <= MAX_AUTH_INTENT_STORAGE_CHARS ? value : null;
  } catch {
    return null;
  }
}

function isValidAuthIntentValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_AUTH_INTENT_STORAGE_CHARS;
}

function normalizeWebAuthRedirectUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_AUTH_INTENT_STORAGE_CHARS) {
    return null;
  }

  const trimmed = value.trim();
  if (
    !trimmed
    || trimmed.length > MAX_AUTH_INTENT_STORAGE_CHARS
    || AUTH_REDIRECT_UNSAFE_CHARS_REGEX.test(trimmed)
    || trimmed.includes('\\')
  ) {
    return null;
  }

  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  const normalized = normalizeExternalHref(trimmed);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? normalized : null;
  } catch {
    return null;
  }
}

function isRelevantElectronAuthEvent(event: string): boolean {
  if (
    event.startsWith('session_status:http') ||
    event.startsWith('session_identity:http') ||
    event.startsWith('stored_session:http')
  ) {
    return true;
  }

  return new Set([
    'ipc:start_auth',
    'oauth:start',
    'oauth:loopback_bound',
    'oauth:start_response',
    'oauth:browser_opened',
    'loopback_callback:received',
    'oauth:callback_resolved',
    'request_auth_result:done',
    'request_auth_result:summary',
    'oauth:completion_resolved',
    'oauth:persist_resolved',
    'oauth:completed',
    'persist_auth_result:missing_token',
    'persist_auth_result:missing_identity',
    'persist_auth_result:session_identity_error',
    'persist_auth_result:session_identity_inline_done',
    'persist_auth_result:done',
    'read_stored_credentials:empty_or_invalid',
    'read_stored_credentials:resolved',
    'write_stored_credentials:done',
    'session_status:start',
    'session_status:unauthorized',
    'session_status:payload',
    'session_status:disconnected_payload',
    'session_status:resolved_connected',
    'session_identity:start',
    'session_identity:unauthorized',
    'session_identity:non_ok',
    'session_identity:payload',
    'session_identity:resolved',
    'clear_stored_credentials:start',
    'clear_stored_credentials:done',
  ]).has(event);
}

export function selectRelevantElectronAuthEntries(entries: Array<{
  timestamp: string;
  event: string;
  details: Record<string, unknown> | null;
}>): Array<{
  timestamp: string;
  event: string;
  details: Record<string, unknown> | null;
}> {
  if (entries.length === 0) {
    return entries;
  }

  const lastStartAuthIndex = entries.findLastIndex((entry) => entry.event === 'ipc:start_auth');
  if (lastStartAuthIndex >= 0) {
    return entries
      .slice(Math.max(0, lastStartAuthIndex - 2))
      .filter((entry) => isRelevantElectronAuthEvent(entry.event));
  }

  const lastSessionIndex = entries.findLastIndex((entry) => entry.event === 'ipc:get_session_status');
  if (lastSessionIndex >= 0) {
    return entries
      .slice(Math.max(0, lastSessionIndex - 2))
      .filter((entry) => isRelevantElectronAuthEvent(entry.event));
  }

  return entries.slice(-40).filter((entry) => isRelevantElectronAuthEvent(entry.event));
}

export function createCheckStatus(set: Set, get: Get): (options?: { force?: boolean }) => Promise<void> {
  return async (options = {}) => {
    const requestVersion = accountSessionMutationVersion;
    if (checkStatusPromise && checkStatusPromiseVersion === requestVersion) {
      return checkStatusPromise;
    }

    const currentState = get();
    const now = Date.now();
    if (
      !options.force &&
      currentState.hasCheckedStatus &&
      lastCheckStatusSyncAt > 0 &&
      now - lastCheckStatusSyncAt < ACCOUNT_STATUS_REFRESH_INTERVAL_MS
    ) {
      return;
    }

    set({ isLoading: true });

    checkStatusPromiseVersion = requestVersion;
    let promise!: Promise<void>;
    promise = (async () => {
      try {
        const status = hasElectronDesktopBridge()
          ? await accountCommands.getAccountSessionStatus()
          : await webAccountCommands.probeStatus();
        if (requestVersion !== accountSessionMutationVersion) {
          return;
        }

        const connected = status?.connected === true;
        const normalizedIdentity = normalizePersistedUser({
          isConnected: connected,
          provider: normalizeAccountProvider(status?.provider),
          username: status?.username ?? null,
          primaryEmail: status?.primaryEmail ?? null,
          avatarUrl: status?.avatarUrl ?? null,
          membershipTier: status?.membershipTier ?? null,
          membershipName: status?.membershipName ?? null,
        });
        const provider = normalizeAccountProvider(normalizedIdentity.provider);
        const sessionInvalidated = status && 'sessionInvalidated' in status && status.sessionInvalidated === true;
        const username = normalizedIdentity.username ?? null;
        const primaryEmail = normalizedIdentity.primaryEmail ?? null;
        const avatarUrl = normalizedIdentity.avatarUrl ?? null;
        const membershipTier = normalizedIdentity.membershipTier ?? null;
        const membershipName = normalizedIdentity.membershipName ?? null;
        const sessionBudget = status && 'budget' in status ? status.budget : null;
        const persistent = !(status && 'persistent' in status && status.persistent === false);
        let shouldRefreshBudgetIfStale = connected;
        let shouldForceRefreshBudget = false;
        if (connected && sessionBudget && typeof sessionBudget === 'object') {
          const normalizedBudget = normalizeManagedBudgetPayload(sessionBudget);
          useManagedAIStore.getState().applyBudgetSnapshot(normalizedBudget);
          shouldRefreshBudgetIfStale = false;
          shouldForceRefreshBudget = !Number.isFinite(Number(normalizedBudget.remainingPercent));
        }

        if (!connected && sessionInvalidated) {
          applyDisconnectedAccount(set);
          useManagedAIStore.getState().clearBudget();
          lastCheckStatusSyncAt = Date.now();
          return;
        }

        if (!connected && get().isConnected === true) {
          set({ isLoading: false, hasCheckedStatus: true });
          lastCheckStatusSyncAt = Date.now();
          return;
        }

        if (!connected) {
          useManagedAIStore.getState().clearBudget();
        }

        set({
          isConnected: connected,
          provider,
          username,
          primaryEmail,
          avatarUrl,
          membershipTier,
          membershipName,
          isLoading: false,
          hasCheckedStatus: true,
          error: connected ? null : get().error,
        });
        lastCheckStatusSyncAt = Date.now();

        if (connected && !persistent) {
          clearPersistedUser();
          broadcastAccountStatusRefresh();
        } else {
          persistUser({ isConnected: connected, provider, username, primaryEmail, avatarUrl, membershipTier, membershipName });
        }
        if (shouldForceRefreshBudget) {
          void useManagedAIStore.getState().refreshBudget();
        } else if (shouldRefreshBudgetIfStale) {
          void useManagedAIStore.getState().refreshBudgetIfStale();
        }
        await refreshAvatar(set, get, username, avatarUrl);
      } catch (error) {
        console.error('Failed to check account auth status:', error);
        if (requestVersion === accountSessionMutationVersion) {
          set({ isLoading: false, hasCheckedStatus: true });
        }
      } finally {
        if (checkStatusPromise === promise) {
          checkStatusPromise = null;
        }
      }
    })();
    checkStatusPromise = promise;

    return checkStatusPromise;
  };
}

export function createSignIn(
  set: Set,
  get: Get
): (provider: Exclude<AccountProvider, 'email'>) => Promise<boolean> {
  return async (provider) => {
    const authAttemptVersion = startAccountAuthAttempt();
    set({ isConnecting: true, error: null });

    const isDesktop = hasElectronDesktopBridge();
    const win = window as Window & { __authTimeout?: number | ReturnType<typeof setTimeout> | null };
    if (win.__authTimeout) {
      clearTimeout(win.__authTimeout);
      win.__authTimeout = null;
    }
    const timeoutId = setTimeout(() => {
      if (isCurrentAccountAuthAttempt(authAttemptVersion) && get().isConnecting) {
        if (isDesktop) {
          void accountCommands.cancelAccountAuth().catch(() => undefined);
        }
        set({ isConnecting: false, error: null });
      }
    }, isDesktop ? 300000 : 60000);

    win.__authTimeout = timeoutId;

    if (isDesktop) {
      try {
        const result = await accountCommands.accountAuth(provider);
        clearTimeout(timeoutId);
        if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
          return false;
        }

        if (result?.success) {
          const normalizedIdentity = normalizePersistedUser({
            isConnected: true,
            provider: normalizeAccountProvider(result.provider) ?? provider,
            username: result.username ?? null,
            primaryEmail: result.primaryEmail ?? null,
            avatarUrl: result.avatarUrl ?? null,
            membershipTier: null,
            membershipName: null,
          });
          const providerFromResult = normalizeAccountProvider(normalizedIdentity.provider);
          const username = normalizedIdentity.username ?? null;
          const primaryEmail = normalizedIdentity.primaryEmail ?? null;
          const avatarUrl = normalizedIdentity.avatarUrl ?? null;
          const membershipTier = normalizedIdentity.membershipTier ?? null;
          const membershipName = normalizedIdentity.membershipName ?? null;

          invalidateAccountSessionChecks();
          set({
            isConnected: true,
            provider: providerFromResult,
            username,
            primaryEmail,
            avatarUrl,
            membershipTier,
            membershipName,
            isConnecting: false,
            isLoading: false,
            hasCheckedStatus: true,
            error: null,
          });
          persistUser({
            isConnected: true,
            provider: providerFromResult,
            username,
            primaryEmail,
            avatarUrl,
            membershipTier,
            membershipName,
          });
          void get().checkStatus({ force: true }).catch(() => undefined);
          void refreshAvatar(set, get, username, avatarUrl);
          return true;
        }

        const errorMessage = result?.error || 'Authorization failed';
        set({
          error: isAuthorizationCancellation(errorMessage) ? null : normalizeAuthError(errorMessage),
          isConnecting: false,
        });
        return false;
      } catch (error) {
        clearTimeout(timeoutId);
        if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
          return false;
        }
        const message = error instanceof Error ? error.message : String(error);
        set({
          error: isAuthorizationCancellation(message) ? null : normalizeAuthError(message),
          isConnecting: false,
        });
        return false;
      }
    }

    try {
      const authData = await webAccountCommands.startAuth(provider);
      clearTimeout(timeoutId);
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      const authUrl = normalizeWebAuthRedirectUrl(authData?.authUrl);
      if (!authData || !isValidAuthIntentValue(authData.state) || !authUrl) {
        set({ error: 'Failed to start account sign-in', isConnecting: false });
        return false;
      }

      try {
        sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, authData.state);
        sessionStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
      } catch {
        if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
          return false;
        }
        set({ error: 'Unable to store sign-in state in this browser session', isConnecting: false });
        return false;
      }
      window.location.href = authUrl;
      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      set({ error: normalizeAuthError(message), isConnecting: false });
      return false;
    }
  };
}

export function createRequestEmailCode(set: Set, get: Get): (email: string) => Promise<boolean> {
  return async (email: string) => {
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail) {
      set({ error: 'Invalid email address' });
      return false;
    }

    const { isConnected, primaryEmail } = get();
    if (isConnected && normalizeEmailInput(primaryEmail) === normalizedEmail) {
      set({ error: 'You are already signed in with this email' });
      return false;
    }

    const authAttemptVersion = startAccountAuthAttempt();
    set({ error: null });
    try {
      const ok = hasElectronDesktopBridge()
        ? await accountCommands.requestEmailAuthCode(normalizedEmail)
        : await webAccountCommands.requestEmailCode(normalizedEmail);
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      if (!ok) {
        set({ error: 'Failed to send verification code' });
      }
      return ok;
    } catch (error) {
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (isEmailCodeRequestCooldownError(message)) {
        set({ error: null });
        return true;
      }
      set({ error: normalizeAuthError(message) });
      return false;
    }
  };
}

export function createVerifyEmailCode(set: Set, get: Get): (email: string, code: string) => Promise<boolean> {
  return async (email: string, code: string) => {
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail) {
      set({ error: 'Invalid email address' });
      return false;
    }

    const normalizedCode = normalizeEmailCodeInput(code);
    if (!normalizedCode) {
      set({ error: 'Invalid verification code' });
      return false;
    }

    const authAttemptVersion = startAccountAuthAttempt();
    set({ error: null });
    try {
      if (hasElectronDesktopBridge()) {
        const result = await accountCommands.verifyEmailAuthCode(normalizedEmail, normalizedCode);
        if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
          return false;
        }
        if (result?.success) {
          invalidateAccountSessionChecks();
          await get().checkStatus({ force: true });
          if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
            return false;
          }
          set({ isConnecting: false, error: null });
          return true;
        }
        set({ error: normalizeAuthError(result?.error || 'Email sign-in failed') });
        return false;
      }

      const result = await webAccountCommands.verifyEmailCode(normalizedEmail, normalizedCode);
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      if (result.success && result.username) {
        invalidateAccountSessionChecks();
        await get().checkStatus({ force: true });
        if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
          return false;
        }
        set({ isConnecting: false, error: null });
        return true;
      }

      set({ error: normalizeAuthError(result.error || 'Email sign-in failed') });
      return false;
    } catch (error) {
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      set({ error: normalizeAuthError(message) });
      return false;
    }
  };
}

export function createHandleAuthCallback(set: Set, get: Get): () => Promise<boolean> {
  return async () => {
    if (hasElectronDesktopBridge()) return false;

    const callback = parseAuthCallback();
    if (!callback) return false;

    const authAttemptVersion = startAccountAuthAttempt();
    set({ isConnecting: true, error: null });

    const savedState = readStoredAuthIntentValue(AUTH_STATE_STORAGE_KEY);
    const savedProvider = normalizeAccountProvider(readStoredAuthIntentValue(AUTH_PROVIDER_STORAGE_KEY));
    clearAuthIntent();

    if (callback.error) {
      set({
        error: isAuthorizationCancellation(callback.error) ? null : normalizeAuthError(callback.error),
        isConnecting: false,
      });
      return false;
    }

    if (!callback.provider || !savedState || !callback.state || savedState !== callback.state) {
      set({ error: 'Account sign-in state mismatch', isConnecting: false });
      return false;
    }

    if (savedProvider && savedProvider !== callback.provider) {
      set({ error: 'Account sign-in provider mismatch', isConnecting: false });
      return false;
    }

    if (!isOauthAccountProvider(callback.provider)) {
      set({ error: 'Unsupported account sign-in provider', isConnecting: false });
      return false;
    }

    try {
      const result = await webAccountCommands.completeAuth(callback.provider, callback.state);
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      if (result.success && result.username) {
        invalidateAccountSessionChecks();
        await get().checkStatus({ force: true });
        if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
          return false;
        }
        set({ isConnecting: false, error: null });
        return true;
      }

      const errorMessage = result.error || 'Account sign-in failed';
      set({
        error: isAuthorizationCancellation(errorMessage) ? null : normalizeAuthError(errorMessage),
        isConnecting: false,
      });
      return false;
    } catch (error) {
      if (!isCurrentAccountAuthAttempt(authAttemptVersion)) {
        return false;
      }
      const message = error instanceof Error ? error.message : String(error);
      set({ error: normalizeAuthError(message), isConnecting: false });
      return false;
    }
  };
}

export function createSignOut(set: Set, _get: Get): () => Promise<void> {
  return async () => {
    invalidateAccountAuthAttempts();
    const win = window as Window & { __authTimeout?: number | ReturnType<typeof setTimeout> | null };
    if (win.__authTimeout) {
      clearTimeout(win.__authTimeout);
      win.__authTimeout = null;
    }
    clearAuthIntent();

    try {
      if (hasElectronDesktopBridge()) {
        await accountCommands.accountDisconnect();
      } else {
        await webAccountCommands.disconnect();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: normalizeAuthError(message) });
      return;
    }

    applyDisconnectedAccount(set);
  };
}

export function createCancelConnect(set: Set, _get: Get): () => Promise<void> {
  return async () => {
    invalidateAccountAuthAttempts();
    const win = window as Window & { __authTimeout?: number | ReturnType<typeof setTimeout> | null };
    if (win.__authTimeout) {
      clearTimeout(win.__authTimeout);
      win.__authTimeout = null;
    }
    clearAuthIntent();

    if (hasElectronDesktopBridge()) {
      await accountCommands.cancelAccountAuth().catch(() => undefined);
    }

    set({ isConnecting: false, error: null });
  };
}
