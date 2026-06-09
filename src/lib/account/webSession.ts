import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import type { ManagedBudgetPayload } from '@/lib/ai/managed/types';
import { normalizeAccountProvider } from '@/lib/account/provider';
import { normalizePublicRemoteMediaUrl } from '@/lib/notes/markdown/urlSecurity';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from './sessionEvent';

const WEB_ACCOUNT_CREDS_KEY = 'vlaina_account_session';
const ACCOUNT_USER_PERSIST_KEY = 'vlaina_account_identity';
const MAX_WEB_ACCOUNT_STORAGE_CHARS = 64 * 1024;
const MAX_WEB_ACCOUNT_USERNAME_CHARS = 256;
const MAX_WEB_ACCOUNT_EMAIL_CHARS = 320;
const MAX_WEB_ACCOUNT_AVATAR_URL_CHARS = 4096;
const MAX_WEB_ACCOUNT_MEMBERSHIP_NAME_CHARS = 128;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export interface WebAccountCredentials {
  provider: AccountProvider;
  username: string;
  primaryEmail?: string | null;
  avatarUrl?: string | null;
  membershipTier?: MembershipTier | null;
  membershipName?: string | null;
}

export interface WebAccountStatus {
  connected: boolean;
  provider: AccountProvider | null;
  username: string | null;
  primaryEmail: string | null;
  avatarUrl: string | null;
  membershipTier: MembershipTier | null;
  membershipName: string | null;
  budget?: ManagedBudgetPayload | null;
}

function clearPersistedIdentity(): void {
  try {
    localStorage.removeItem(ACCOUNT_USER_PERSIST_KEY);
  } catch {
  }
}

function normalizeWebAccountString(value: unknown, maxChars: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxChars || CONTROL_OR_BIDI_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeMembershipTier(value: unknown): MembershipTier | null {
  return value === 'free' || value === 'plus' || value === 'pro' || value === 'max' || value === 'ultra'
    ? value
    : null;
}

function normalizeWebAccountCredentials(value: unknown): WebAccountCredentials | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const parsed = value as Record<string, unknown>;
  const provider = normalizeAccountProvider(typeof parsed.provider === 'string' ? parsed.provider : null);
  const username = normalizeWebAccountString(parsed.username, MAX_WEB_ACCOUNT_USERNAME_CHARS);
  if (!provider || !username) {
    return null;
  }

  const avatarUrl = normalizeWebAccountString(parsed.avatarUrl, MAX_WEB_ACCOUNT_AVATAR_URL_CHARS);
  return {
    provider,
    username,
    primaryEmail: normalizeWebAccountString(parsed.primaryEmail, MAX_WEB_ACCOUNT_EMAIL_CHARS),
    avatarUrl: avatarUrl ? normalizePublicRemoteMediaUrl(avatarUrl) : null,
    membershipTier: normalizeMembershipTier(parsed.membershipTier),
    membershipName: normalizeWebAccountString(parsed.membershipName, MAX_WEB_ACCOUNT_MEMBERSHIP_NAME_CHARS),
  };
}

function loadPersistedWebAccountIdentity(): WebAccountCredentials | null {
  try {
    const stored = localStorage.getItem(ACCOUNT_USER_PERSIST_KEY);
    if (!stored) return null;
    if (stored.length > MAX_WEB_ACCOUNT_STORAGE_CHARS) return null;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    if (parsed.isConnected !== true) return null;
    return normalizeWebAccountCredentials(parsed);
  } catch {
    return null;
  }
}

export function loadWebAccountCredentials(): WebAccountCredentials | null {
  try {
    const stored = sessionStorage.getItem(WEB_ACCOUNT_CREDS_KEY);
    if (!stored) return null;
    if (stored.length > MAX_WEB_ACCOUNT_STORAGE_CHARS) return null;
    return normalizeWebAccountCredentials(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveWebAccountCredentials(creds: WebAccountCredentials): void {
  const normalized = normalizeWebAccountCredentials(creds);
  if (!normalized) {
    return;
  }

  try {
    sessionStorage.setItem(WEB_ACCOUNT_CREDS_KEY, JSON.stringify(normalized));
  } catch {
  }
}

export function clearWebAccountCredentials(): void {
  clearPersistedIdentity();
  try {
    sessionStorage.removeItem(WEB_ACCOUNT_CREDS_KEY);
  } catch {
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));
  }
}

export function getCachedWebAccountStatus(): WebAccountStatus {
  const creds = loadWebAccountCredentials() ?? loadPersistedWebAccountIdentity();
  return {
    connected: !!creds,
    provider: creds?.provider || null,
    username: creds?.username || null,
    primaryEmail: creds?.primaryEmail || null,
    avatarUrl: creds?.avatarUrl || null,
    membershipTier: creds?.membershipTier || null,
    membershipName: creds?.membershipName || null,
  };
}
