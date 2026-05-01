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
    'persist_auth_result:session_identity_deferred_applied',
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

function logAccountAuthStep(event: string, details: Record<string, unknown> = {}): void {
  if (import.meta.env.DEV) {
    console.info(`[account:auth] ${event}`, details);
  }
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

export function createCheckStatus(set: Set, get: Get): () => Promise<void> {
  return async () => {
    set({ isLoading: true });

    try {
      const status = hasElectronDesktopBridge()
        ? await accountCommands.getAccountSessionStatus()
        : await webAccountCommands.probeStatus();
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

    const isDesktop = hasElectronDesktopBridge();
    const timeoutId = setTimeout(() => {
      if (get().isConnecting) {
        if (isDesktop) {
          void accountCommands.cancelAccountAuth().catch(() => undefined);
        }
        set({ isConnecting: false, error: null });
      }
    }, isDesktop ? 300000 : 60000);

    (window as Window & { __vlaina_auth_timeout?: number | ReturnType<typeof setTimeout> | null }).__vlaina_auth_timeout =
      timeoutId;

    if (isDesktop) {
      try {
        const authStartedAt = performance.now();
        logAccountAuthStep('desktop_auth:start', { provider });
        const result = await accountCommands.accountAuth(provider);
        logAccountAuthStep('desktop_auth:resolved', {
          provider,
          durationMs: Math.max(0, Math.round(performance.now() - authStartedAt)),
          success: result?.success === true,
          hasAvatarUrl: typeof result?.avatarUrl === 'string' && result.avatarUrl.trim().length > 0,
        });
        clearTimeout(timeoutId);

        if (result?.success) {
          const checkStartedAt = performance.now();
          await get().checkStatus();
          logAccountAuthStep('desktop_auth:check_status_resolved', {
            provider,
            durationMs: Math.max(0, Math.round(performance.now() - checkStartedAt)),
          });
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

export function createCancelConnect(set: Set, _get: Get): () => Promise<void> {
  return async () => {
    const win = window as Window & { __vlaina_auth_timeout?: number | ReturnType<typeof setTimeout> | null };
    if (win.__vlaina_auth_timeout) {
      clearTimeout(win.__vlaina_auth_timeout);
      win.__vlaina_auth_timeout = null;
    }
    clearAuthIntent();

    if (hasElectronDesktopBridge()) {
      await accountCommands.cancelAccountAuth().catch(() => undefined);
    }

    set({ isConnecting: false, error: null });
  };
}
