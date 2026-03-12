import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState } from './state';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { accountCommands } from '@/lib/tauri/accountAuthCommands';
import { webAccountCommands, handleAuthCallback as parseAuthCallback } from '@/lib/tauri/webAccountCommands';
import { isOauthAccountProvider, normalizeAccountProvider } from '@/lib/account/provider';
import {
  AUTH_PROVIDER_STORAGE_KEY,
  AUTH_STATE_STORAGE_KEY,
  clearAuthIntent,
  normalizeAuthError,
  persistUser,
  refreshAvatar,
} from './authSupport';
import { applyConnectedAccount, applyDisconnectedAccount } from './sessionState';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

export function createCheckStatus(set: Set, get: Get): () => Promise<void> {
  return async () => {
    set({ isLoading: true });

    try {
      const status = hasBackendCommands()
        ? await accountCommands.getAccountSessionStatus()
        : await webAccountCommands.probeStatus();
      const provider = normalizeAccountProvider(status?.provider);
      const connected = status?.connected === true;
      const username = status?.username ?? null;
      const primaryEmail = status?.primaryEmail ?? null;
      const avatarUrl = status?.avatarUrl ?? null;

      set({
        isConnected: connected,
        provider,
        username,
        primaryEmail,
        avatarUrl,
        isLoading: false,
        error: connected ? null : get().error,
      });

      persistUser({ isConnected: connected, provider, username, primaryEmail, avatarUrl });
      await refreshAvatar(set, get, username, avatarUrl);
    } catch (error) {
      console.error('Failed to check account auth status:', error);
      applyDisconnectedAccount(set);
    }
  };
}

export function createSignIn(
  set: Set,
  get: Get
): (provider: Exclude<AccountProvider, 'email'>) => Promise<boolean> {
  return async (provider) => {
    set({ isConnecting: true, error: null });

    const timeoutId = setTimeout(() => {
      if (get().isConnecting) {
        set({ isConnecting: false, error: null });
      }
    }, 60000);

    (window as Window & { __nekotick_auth_timeout?: number | ReturnType<typeof setTimeout> | null }).__nekotick_auth_timeout =
      timeoutId;

    if (hasBackendCommands()) {
      try {
        const result = await accountCommands.accountAuth(provider);
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

export function createRequestEmailCode(set: Set, _get: Get): (email: string) => Promise<boolean> {
  return async (email: string) => {
    set({ error: null });
    try {
      const ok = hasBackendCommands()
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
      if (hasBackendCommands()) {
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
        const provider = normalizeAccountProvider(result.provider) || 'email';
        const primaryEmail = result.primaryEmail || null;
        const avatarUrl = result.avatarUrl || null;

        await applyConnectedAccount(set, get, {
          provider,
          username: result.username,
          primaryEmail,
          avatarUrl,
        });
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
    if (hasBackendCommands()) return false;

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
      const provider = normalizeAccountProvider(result.provider) || callback.provider;
      const primaryEmail = result.primaryEmail || null;
      const avatarUrl = result.avatarUrl || null;

      await applyConnectedAccount(set, get, {
        provider,
        username: result.username,
        primaryEmail,
        avatarUrl,
      });
      return true;
    }

    set({ error: normalizeAuthError(result.error || 'Account sign-in failed'), isConnecting: false });
    return false;
  };
}

export function createSignOut(set: Set, _get: Get): () => Promise<void> {
  return async () => {
    const win = window as Window & { __nekotick_auth_timeout?: number | ReturnType<typeof setTimeout> | null };
    if (win.__nekotick_auth_timeout) {
      clearTimeout(win.__nekotick_auth_timeout);
      win.__nekotick_auth_timeout = null;
    }
    clearAuthIntent();

    try {
      if (hasBackendCommands()) {
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
