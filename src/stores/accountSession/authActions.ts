import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState } from './state';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { accountCommands } from '@/lib/account/desktopCommands';
import { webAccountCommands, handleAuthCallback as parseAuthCallback } from '@/lib/account/webCommands';
import { isOauthAccountProvider, normalizeAccountProvider } from '@/lib/account/provider';
import {
  AUTH_PROVIDER_STORAGE_KEY,
  AUTH_STATE_STORAGE_KEY,
  clearAuthIntent,
  normalizeAuthError,
  persistUser,
  refreshAvatar,
} from './authSupport';
import { applyDisconnectedAccount } from './sessionState';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stringifyAuthDebug(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return `[unserializable: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

function selectRelevantElectronAuthEntries(entries: Array<{
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

  const importantEvents = new Set([
    'ipc:start_auth',
    'oauth:start',
    'loopback_callback:received',
    'oauth:callback_resolved',
    'request_auth_result:summary',
    'persist_auth_result:missing_token',
    'persist_auth_result:missing_identity',
    'persist_auth_result:done',
    'read_stored_credentials:empty_or_invalid',
    'read_stored_credentials:resolved',
    'session_status:start',
    'session_status:unauthorized',
    'session_status:payload',
    'session_status:disconnected_payload',
    'session_status:resolved_connected',
    'clear_stored_credentials:start',
    'clear_stored_credentials:done',
  ]);

  const lastStartAuthIndex = entries.findLastIndex((entry) => entry.event === 'ipc:start_auth');
  if (lastStartAuthIndex >= 0) {
    return entries
      .slice(Math.max(0, lastStartAuthIndex - 2))
      .filter((entry) => importantEvents.has(entry.event));
  }

  const lastSessionIndex = entries.findLastIndex((entry) => entry.event === 'ipc:get_session_status');
  if (lastSessionIndex >= 0) {
    return entries
      .slice(Math.max(0, lastSessionIndex - 2))
      .filter((entry) => importantEvents.has(entry.event));
  }

  return entries.slice(-20).filter((entry) => importantEvents.has(entry.event));
}

async function dumpElectronAuthDebugLog(label: string): Promise<void> {
  if (!import.meta.env.DEV || !hasElectronDesktopBridge()) {
    return;
  }

  try {
    const entries = await accountCommands.getAuthDebugLog();
    const relevantEntries = selectRelevantElectronAuthEntries(entries);
    console.info(`[account auth] ${label}:electron_debug_log`, relevantEntries);
    console.info(
      `[account auth] ${label}:electron_debug_log:json`,
      stringifyAuthDebug(relevantEntries),
    );
  } catch (error) {
    console.error(
      `[account auth] ${label}:electron_debug_log:error`,
      stringifyAuthDebug({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? null : null,
      }),
    );
  }
}

export function createCheckStatus(set: Set, get: Get): () => Promise<void> {
  return async () => {
    if (import.meta.env.DEV) {
      console.info('[account auth] checkStatus:start', {
        electron: hasElectronDesktopBridge(),
      });
    }
    set({ isLoading: true });

    try {
      const status = hasElectronDesktopBridge()
        ? await accountCommands.getAccountSessionStatus()
        : await webAccountCommands.probeStatus();
      if (import.meta.env.DEV) {
        console.info('[account auth] checkStatus:status', status);
        console.info('[account auth] checkStatus:status:json', stringifyAuthDebug(status));
        await dumpElectronAuthDebugLog('checkStatus');
      }
      const provider = normalizeAccountProvider(status?.provider);
      const connected = status?.connected === true;
      const username = status?.username ?? null;
      const primaryEmail = status?.primaryEmail ?? null;
      const avatarUrl = status?.avatarUrl ?? null;
      const membershipTier =
        status?.membershipTier === 'free' || status?.membershipTier === 'plus' || status?.membershipTier === 'pro' || status?.membershipTier === 'max'
          ? status.membershipTier
          : null;
      const membershipName =
        typeof status?.membershipName === 'string' && status.membershipName.trim() ? status.membershipName.trim() : null;

      set({
        isConnected: connected,
        provider,
        username,
        primaryEmail,
        avatarUrl,
        membershipTier,
        membershipName,
        isLoading: false,
        error: connected ? null : get().error,
      });

      persistUser({ isConnected: connected, provider, username, primaryEmail, avatarUrl, membershipTier, membershipName });
      await refreshAvatar(set, get, username, avatarUrl);
    } catch (error) {
      console.error('Failed to check account auth status:', error);
      if (import.meta.env.DEV) {
        console.error(
          '[account auth] checkStatus:error:json',
          stringifyAuthDebug({
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack ?? null : null,
          }),
        );
      }
      applyDisconnectedAccount(set);
    }
  };
}

export function createSignIn(
  set: Set,
  get: Get
): (provider: Exclude<AccountProvider, 'email'>) => Promise<boolean> {
  return async (provider) => {
    if (import.meta.env.DEV) {
      console.info('[account auth] signIn:start', {
        provider,
        electron: hasElectronDesktopBridge(),
      });
      console.info(
        '[account auth] signIn:start:json',
        stringifyAuthDebug({
          provider,
          electron: hasElectronDesktopBridge(),
        }),
      );
    }
    set({ isConnecting: true, error: null });

    const timeoutId = setTimeout(() => {
      if (get().isConnecting) {
        set({ isConnecting: false, error: null });
      }
    }, 60000);

    (window as Window & { __vlaina_auth_timeout?: number | ReturnType<typeof setTimeout> | null }).__vlaina_auth_timeout =
      timeoutId;

    if (hasElectronDesktopBridge()) {
      try {
        const result = await accountCommands.accountAuth(provider);
        if (import.meta.env.DEV) {
          console.info('[account auth] signIn:electron_result', result);
          console.info('[account auth] signIn:electron_result:json', stringifyAuthDebug(result));
          await dumpElectronAuthDebugLog('signIn');
        }
        clearTimeout(timeoutId);

        if (result?.success) {
          await get().checkStatus();
          set({ isConnecting: false, error: null });
          return true;
        }

        set({
          error: normalizeAuthError(result?.error || 'Authorization failed'),
          isConnecting: false,
        });
        return false;
      } catch (error) {
        clearTimeout(timeoutId);
        const message = error instanceof Error ? error.message : String(error);
        set({ error: normalizeAuthError(message), isConnecting: false });
        return false;
      }
    }

    try {
      const authData = await webAccountCommands.startAuth(provider);
      clearTimeout(timeoutId);
      if (!authData) {
        set({ error: 'Failed to start account sign-in', isConnecting: false });
        return false;
      }

      sessionStorage.setItem(AUTH_STATE_STORAGE_KEY, authData.state);
      sessionStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, provider);
      window.location.href = authData.authUrl;
      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : String(error);
      set({ error: normalizeAuthError(message), isConnecting: false });
      return false;
    }
  };
}

export function createRequestEmailCode(set: Set, get: Get): (email: string) => Promise<boolean> {
  return async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      set({ error: 'Invalid email address' });
      return false;
    }

    const { isConnected, primaryEmail } = get();
    if (isConnected && primaryEmail?.trim().toLowerCase() === normalizedEmail) {
      set({ error: 'You are already signed in with this email' });
      return false;
    }

    set({ error: null });
    try {
      const ok = hasElectronDesktopBridge()
        ? await accountCommands.requestEmailAuthCode(email)
        : await webAccountCommands.requestEmailCode(email);
      if (!ok) {
        set({ error: 'Failed to send verification code' });
      }
      return ok;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ error: normalizeAuthError(message) });
      return false;
    }
  };
}

export function createVerifyEmailCode(set: Set, get: Get): (email: string, code: string) => Promise<boolean> {
  return async (email: string, code: string) => {
    set({ error: null });
    try {
      if (hasElectronDesktopBridge()) {
        const result = await accountCommands.verifyEmailAuthCode(email, code);
        if (result?.success) {
          await get().checkStatus();
          set({ isConnecting: false, error: null });
          return true;
        }
        set({ error: normalizeAuthError(result?.error || 'Email sign-in failed') });
        return false;
      }

      const result = await webAccountCommands.verifyEmailCode(email, code);
      if (result.success && result.username) {
        await get().checkStatus();
        set({ isConnecting: false, error: null });
        return true;
      }

      set({ error: normalizeAuthError(result.error || 'Email sign-in failed') });
      return false;
    } catch (error) {
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

    set({ isConnecting: true, error: null });

    const savedState = sessionStorage.getItem(AUTH_STATE_STORAGE_KEY);
    const savedProvider = normalizeAccountProvider(sessionStorage.getItem(AUTH_PROVIDER_STORAGE_KEY));
    clearAuthIntent();

    if (callback.error) {
      set({ error: normalizeAuthError(callback.error), isConnecting: false });
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

    const result = await webAccountCommands.completeAuth(callback.provider, callback.state);
    if (result.success && result.username) {
      await get().checkStatus();
      set({ isConnecting: false, error: null });
      return true;
    }

    set({ error: normalizeAuthError(result.error || 'Account sign-in failed'), isConnecting: false });
    return false;
  };
}

export function createSignOut(set: Set, _get: Get): () => Promise<void> {
  return async () => {
    const win = window as Window & { __vlaina_auth_timeout?: number | ReturnType<typeof setTimeout> | null };
    if (win.__vlaina_auth_timeout) {
      clearTimeout(win.__vlaina_auth_timeout);
      win.__vlaina_auth_timeout = null;
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
