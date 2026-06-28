import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import type { ManagedBudgetPayload } from '@/lib/ai/managed/types';
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
const TRANSIENT_ACCOUNT_RETRY_DELAYS_MS = [250, 750];
const ACCOUNT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_ACCOUNT_RESPONSE_BODY_BYTES = 64 * 1024;
const MAX_ACCOUNT_CONTENT_LENGTH_CHARS = 32;
const MAX_ACCOUNT_EMAIL_INPUT_CHARS = 4096;
const MAX_ACCOUNT_EMAIL_CHARS = 320;
const MAX_ACCOUNT_EMAIL_CODE_INPUT_CHARS = 64;
const EMAIL_CODE_PATTERN = /^\d{6}$/;

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
  budget?: ManagedBudgetPayload | null;
}

function authStartPath(_provider: Exclude<AccountProvider, 'email'>): string {
  return '/auth/google';
}

function webResultPath(_provider: Exclude<AccountProvider, 'email'>): string {
  return '/auth/google/web/result';
}

function normalizeEmailInput(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > MAX_ACCOUNT_EMAIL_INPUT_CHARS) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0
    && normalized.length <= MAX_ACCOUNT_EMAIL_CHARS
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
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
  return 'Web sign-in is unavailable on local development origins. Use vlaina.com/pricing or the desktop app.';
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

function createAccountTimeoutError(): Error {
  return new Error('Account API request timed out.');
}

function throwIfTimedOut(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw createAccountTimeoutError();
}

async function raceAccountRequest<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfTimedOut(signal);
  promise.catch(() => undefined);

  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAccountTimeoutError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfTimedOut(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfTimedOut(signal);
            reject(error);
          } catch (timeoutError) {
            reject(timeoutError);
          }
        });
      }
    );
  });
}

async function withAccountRequestTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
  }, ACCOUNT_REQUEST_TIMEOUT_MS);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw createAccountTimeoutError();
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchAccountResponse(input: RequestInfo | URL, init: RequestInit = {}, signal: AbortSignal): Promise<Response> {
  throwIfTimedOut(signal);
  const response = await raceAccountRequest(fetch(input, {
    ...init,
    signal,
  }), signal);
  throwIfTimedOut(signal);
  return response;
}

function readContentLength(response: Response): number | null {
  const rawContentLength = response.headers?.get('content-length');
  if (!rawContentLength) {
    return null;
  }

  if (rawContentLength.length > MAX_ACCOUNT_CONTENT_LENGTH_CHARS) {
    return null;
  }
  const trimmed = rawContentLength.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function readAccountResponseText(response: Response, signal: AbortSignal): Promise<string> {
  throwIfTimedOut(signal);
  const contentLength = readContentLength(response);
  if (contentLength !== null && contentLength > MAX_ACCOUNT_RESPONSE_BODY_BYTES) {
    void response.body?.cancel().catch(() => undefined);
    throw new Error('Account API response body is too large.');
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  const cancelReader = () => {
    void reader.cancel(createAccountTimeoutError()).catch(() => undefined);
  };
  signal.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceAccountRequest(reader.read(), signal);
      throwIfTimedOut(signal);
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_ACCOUNT_RESPONSE_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new Error('Account API response body is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    signal.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

async function readAccountJson<T>(response: Response, signal: AbortSignal): Promise<T> {
  throwIfTimedOut(signal);
  const text = await readAccountResponseText(response, signal);
  throwIfTimedOut(signal);
  return JSON.parse(text) as T;
}

async function fetchAccountJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<{ response: Response; data: T }> {
  return await withAccountRequestTimeout(async (signal) => {
    const response = await fetchAccountResponse(input, init, signal);
    const data = await readAccountJson<T>(response, signal);
    return { response, data };
  });
}

async function fetchAccount(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return await withAccountRequestTimeout((signal) => fetchAccountResponse(input, init, signal));
}

async function probeWebSession(): Promise<WebAccountStatus> {
  const response = await fetchAccount(`${API_BASE}/auth/session?include_budget=1`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    return getCachedWebAccountStatus();
  }

  if (!response.ok) {
    throw new Error(`Failed to verify session: HTTP ${response.status}`);
  }

  const data = await withAccountRequestTimeout((signal) => readAccountJson<SessionStatusResponse>(response, signal));
  return {
    connected: data.connected === true,
    provider: normalizeAccountProvider(data.provider),
    username: typeof data.username === 'string' ? data.username : null,
    primaryEmail: typeof data.primaryEmail === 'string' ? data.primaryEmail : null,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    membershipTier:
      data.membershipTier === 'free' || data.membershipTier === 'plus' || data.membershipTier === 'pro' || data.membershipTier === 'max'
        || data.membershipTier === 'ultra'
        ? data.membershipTier
        : null,
    membershipName: typeof data.membershipName === 'string' ? data.membershipName : null,
    budget: data.budget && typeof data.budget === 'object' ? data.budget : null,
  };
}

async function revokeWebSession(): Promise<void> {
  const response = await fetchAccount(`${API_BASE}/auth/session/revoke`, {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTransientAccountNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }
  return (
    error instanceof TypeError ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed') ||
    message.includes('err_internet_disconnected')
  );
}

async function retryTransientAccountNetworkError<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_ACCOUNT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientAccountNetworkError(error) || attempt >= TRANSIENT_ACCOUNT_RETRY_DELAYS_MS.length) {
        throw error;
      }
      await delay(TRANSIENT_ACCOUNT_RETRY_DELAYS_MS[attempt] ?? 0);
    }
  }
  throw lastError;
}

async function readJsonErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await withAccountRequestTimeout((signal) => readAccountJson<{ error?: string }>(response, signal));
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
  }
  return fallback;
}

export const webAccountCommands = {
  async startAuth(
    provider: Exclude<AccountProvider, 'email'>
  ): Promise<{ authUrl: string; state: string } | null> {
    assertSupportedWebAccountOrigin();

    try {
      const res = await retryTransientAccountNetworkError(() =>
        fetchAccount(`${API_BASE}${authStartPath(provider)}`, {
          cache: 'no-store',
          credentials: 'include',
        })
      );
      if (!res.ok) return null;
      return await withAccountRequestTimeout((signal) => readAccountJson<{ authUrl: string; state: string }>(res, signal));
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
        const { data } = await retryTransientAccountNetworkError(() =>
          fetchAccountJson<WebAuthResult>(endpoint, {
            method: 'GET',
            cache: 'no-store',
            credentials: 'include',
          })
        );
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

  async requestEmailCode(email: string, locale?: string): Promise<boolean> {
    assertSupportedWebAccountOrigin();
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail) {
      throw new Error('Invalid email address');
    }

    const response = await retryTransientAccountNetworkError(() =>
      fetchAccount(`${API_BASE}/auth/email/request-code`, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, locale: locale || null }),
      })
    );

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
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail) {
      return {
        success: false,
        provider: 'email',
        primaryEmail: null,
        avatarUrl: null,
        membershipTier: null,
        membershipName: null,
        error: 'Invalid email address',
      };
    }
    const normalizedCode = normalizeEmailCodeInput(code);
    if (!normalizedCode) {
      return {
        success: false,
        provider: 'email',
        primaryEmail: null,
        avatarUrl: null,
        membershipTier: null,
        membershipName: null,
        error: 'Invalid verification code',
      };
    }

    try {
      const { data } = await retryTransientAccountNetworkError(() =>
        fetchAccountJson<WebAuthResult>(`${API_BASE}/auth/email/verify-code`, {
          method: 'POST',
          cache: 'no-store',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: normalizedEmail, code: normalizedCode, target: 'web' }),
        })
      );
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
          budget: status.budget ?? null,
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
