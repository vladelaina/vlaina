import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import { normalizeAccountProvider } from '@/lib/account/provider';

const WEB_ACCOUNT_CREDS_KEY = 'nekotick_account_session';
const ACCOUNT_USER_PERSIST_KEY = 'nekotick_account_identity';

export const ACCOUNT_AUTH_INVALIDATED_EVENT = 'nekotick:account-auth-invalidated';

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
}

function clearPersistedIdentity(): void {
  try {
    localStorage.removeItem(ACCOUNT_USER_PERSIST_KEY);
  } catch {
  }
}

export function loadWebAccountCredentials(): WebAccountCredentials | null {
  try {
    const stored = sessionStorage.getItem(WEB_ACCOUNT_CREDS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as {
      provider?: string;
      username?: string;
      primaryEmail?: string | null;
      avatarUrl?: string | null;
      membershipTier?: MembershipTier | null;
      membershipName?: string | null;
    };
    const provider = normalizeAccountProvider(parsed.provider);
    const username = typeof parsed.username === 'string' ? parsed.username.trim() : '';
    if (!provider || !username) return null;
    return {
      provider,
      username,
      primaryEmail: typeof parsed.primaryEmail === 'string' ? parsed.primaryEmail : null,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : null,
      membershipTier:
        parsed.membershipTier === 'free' || parsed.membershipTier === 'plus' || parsed.membershipTier === 'pro' || parsed.membershipTier === 'max'
          ? parsed.membershipTier
          : null,
      membershipName: typeof parsed.membershipName === 'string' ? parsed.membershipName : null,
    };
  } catch {
    return null;
  }
}

export function saveWebAccountCredentials(creds: WebAccountCredentials): void {
  sessionStorage.setItem(WEB_ACCOUNT_CREDS_KEY, JSON.stringify(creds));
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
  const creds = loadWebAccountCredentials();
  return {
    connected: false,
    provider: creds?.provider || null,
    username: creds?.username || null,
    primaryEmail: creds?.primaryEmail || null,
    avatarUrl: creds?.avatarUrl || null,
    membershipTier: creds?.membershipTier || null,
    membershipName: creds?.membershipName || null,
  };
}
