import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import { normalizeAccountProvider } from '@/lib/account/provider';
import {
  clearWebAccountCredentials,
  getCachedWebAccountStatus,
  saveWebAccountCredentials,
  type WebAccountStatus,
} from './webSession';
import { handleWebAccountAuthCallback } from './webCallback';

const API_BASE = 'https://api.vlaina.com';
const WEB_RESULT_POLL_ATTEMPTS = 10;
const WEB_RESULT_POLL_DELAY_MS = 300;

interface WebAuthResult {
  success: boolean;
  pending?: boolean;
  provider?: string;
  username?: string;
  primaryEmail?: string | null;
  avatarUrl?: string | null;
  error?: string;
}

interface SessionStatusResponse {
  success: boolean;
  connected: boolean;
  provider?: string | null;
  username?: string | null;
  primaryEmail?: string | null;
  avatarUrl?: string | null;
  membershipTier?: MembershipTier | null;
  membershipName?: string | null;
}

function authStartPath(provider: Exclude<AccountProvider, 'email'>): string {
  return provider === 'google' ? '/auth/google' : '/auth/github';
}

function webResultPath(provider: Exclude<AccountProvider, 'email'>): string {
  return provider === 'google' ? '/auth/google/web/result' : '/auth/github/web/result';
}

interface NormalizedWebAccountResult {
  success: boolean;
  provider: AccountProvider | null;
  username?: string;
  primaryEmail: string | null;
  avatarUrl: string | null;
  membershipTier: MembershipTier | null;
  membershipName: string | null;
  error?: string;
}

function normalizeWebAuthResult(
  data: WebAuthResult,
  fallbackProvider: AccountProvider
): NormalizedWebAccountResult {
  return {
    success: data.success,
    provider: normalizeAccountProvider(data.provider) || fallbackProvider,
    username: data.username,
    primaryEmail: data.primaryEmail || null,
    avatarUrl: data.avatarUrl || null,
    membershipTier: null,
    membershipName: null,
    error: data.error,
  };
}

function isSupportedWebAccountOrigin(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  if (!hostname) {
    return true;
  }

  return hostname === 'vlaina.com' || hostname.endsWith('.vlaina.com');
}

function getUnsupportedWebAccountOriginMessage(): string {
  return 'Web sign-in is unavailable on local development origins. Use app.vlaina.com or the desktop app.';
}

function assertSupportedWebAccountOrigin(): void {
  if (!isSupportedWebAccountOrigin()) {
    throw new Error(getUnsupportedWebAccountOriginMessage());
  }
}

function persistConnectedWebAccount(result: NormalizedWebAccountResult): void {
  if (!result.success || !result.username || !result.provider) {
    return;
  }

  saveWebAccountCredentials({
    provider: result.provider,
    username: result.username,
    primaryEmail: result.primaryEmail,
    avatarUrl: result.avatarUrl,
    membershipTier: result.membershipTier,
    membershipName: result.membershipName,
  });
}

async function probeWebSession(): Promise<WebAccountStatus> {
  const response = await fetch(`${API_BASE}/auth/session`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    clearWebAccountCredentials();
    return {
      connected: false,
      provider: null,
      username: null,
      primaryEmail: null,
      avatarUrl: null,
      membershipTier: null,
      membershipName: null,
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to verify session: HTTP ${response.status}`);
  }

  const data = (await response.json()) as SessionStatusResponse;
  return {
    connected: data.connected === true,
    provider: normalizeAccountProvider(data.provider),
    username: typeof data.username === 'string' ? data.username : null,
    primaryEmail: typeof data.primaryEmail === 'string' ? data.primaryEmail : null,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    membershipTier:
      data.membershipTier === 'free' || data.membershipTier === 'plus' || data.membershipTier === 'pro' || data.membershipTier === 'max'
        ? data.membershipTier
        : null,
    membershipName: typeof data.membershipName === 'string' ? data.membershipName : null,
  };
}

async function revokeWebSession(): Promise<void> {
  const response = await fetch(`${API_BASE}/auth/session/revoke`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.ok || response.status === 401 || response.status === 403) {
    return;
  }

  throw new Error(`Failed to revoke session: HTTP ${response.status}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readJsonErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
  }
  return fallback;
}

export const webAccountCommands = {
  clearClientSession(): void {
    clearWebAccountCredentials();
  },

  async startAuth(
    provider: Exclude<AccountProvider, 'email'>
  ): Promise<{ authUrl: string; state: string } | null> {
    assertSupportedWebAccountOrigin();

    try {
      const res = await fetch(`${API_BASE}${authStartPath(provider)}`, {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  async completeAuth(
    provider: Exclude<AccountProvider, 'email'>,
    state: string
  ): Promise<{
    success: boolean;
    provider?: AccountProvider | null;
    username?: string;
    primaryEmail?: string | null;
    avatarUrl?: string | null;
    membershipTier?: MembershipTier | null;
    membershipName?: string | null;
    error?: string;
  }> {
    try {
      const endpoint = new URL(`${API_BASE}${webResultPath(provider)}`);
      endpoint.searchParams.set('state', state);
      for (let attempt = 0; attempt < WEB_RESULT_POLL_ATTEMPTS; attempt += 1) {
        const res = await fetch(endpoint, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
        });
        const data = (await res.json()) as WebAuthResult;
        if (data.pending === true && !data.success) {
          await delay(WEB_RESULT_POLL_DELAY_MS);
          continue;
        }

        const result = normalizeWebAuthResult(data, provider);
        persistConnectedWebAccount(result);
        return result;
      }
      return { success: false, error: 'Account sign-in timed out' };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  async requestEmailCode(email: string): Promise<boolean> {
    assertSupportedWebAccountOrigin();

    const response = await fetch(`${API_BASE}/auth/email/request-code`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (response.ok) {
      return true;
    }

    throw new Error(await readJsonErrorMessage(response, `Failed to send verification code: HTTP ${response.status}`));
  },

  async verifyEmailCode(email: string, code: string): Promise<{
    success: boolean;
    provider?: AccountProvider | null;
    username?: string;
    primaryEmail?: string | null;
    avatarUrl?: string | null;
    membershipTier?: MembershipTier | null;
    membershipName?: string | null;
    error?: string;
  }> {
    assertSupportedWebAccountOrigin();

    try {
      const response = await fetch(`${API_BASE}/auth/email/verify-code`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code, target: 'web' }),
      });
      const data = (await response.json()) as WebAuthResult;
      const result = normalizeWebAuthResult(data, 'email');
      persistConnectedWebAccount(result);
      return result;
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },

  getStatus(): WebAccountStatus {
    return getCachedWebAccountStatus();
  },

  async probeStatus(): Promise<WebAccountStatus> {
    const cached = getCachedWebAccountStatus();
    if (!isSupportedWebAccountOrigin()) {
      return cached;
    }

    try {
      const status = await probeWebSession();
      if (status.connected) {
        return {
          connected: true,
          provider: status.provider || cached.provider,
          username: status.username || cached.username,
          primaryEmail: status.primaryEmail || cached.primaryEmail,
          avatarUrl: status.avatarUrl || cached.avatarUrl,
          membershipTier: status.membershipTier || cached.membershipTier,
          membershipName: status.membershipName || cached.membershipName,
        };
      }
      return status;
    } catch {
      return cached;
    }
  },

  async disconnect(): Promise<void> {
    await revokeWebSession();
    clearWebAccountCredentials();
  },
};

export const handleAuthCallback = handleWebAccountAuthCallback;
