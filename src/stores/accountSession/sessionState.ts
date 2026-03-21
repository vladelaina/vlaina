import type { StoreApi } from 'zustand';
import type { AccountProvider, AccountSessionActions, AccountSessionState, MembershipTier } from './state';
import { persistUser, refreshAvatar } from './authSupport';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

interface ConnectedAccountIdentity {
  provider: AccountProvider;
  username: string;
  primaryEmail: string | null;
  avatarUrl: string | null;
  membershipTier?: MembershipTier | null;
  membershipName?: string | null;
}

export async function applyConnectedAccount(
  set: Set,
  get: Get,
  identity: ConnectedAccountIdentity
): Promise<void> {
  set({
    isConnected: true,
    provider: identity.provider,
    username: identity.username,
    primaryEmail: identity.primaryEmail,
    avatarUrl: identity.avatarUrl,
    membershipTier: identity.membershipTier || null,
    membershipName: identity.membershipName || null,
    isConnecting: false,
    error: null,
  });

  persistUser({
    isConnected: true,
    provider: identity.provider,
    username: identity.username,
    primaryEmail: identity.primaryEmail,
    avatarUrl: identity.avatarUrl,
    membershipTier: identity.membershipTier || null,
    membershipName: identity.membershipName || null,
  });
  await refreshAvatar(set, get, identity.username, identity.avatarUrl);
}

export function applyDisconnectedAccount(set: Set): void {
  set({
    isConnected: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    membershipTier: null,
    membershipName: null,
    localAvatarUrl: null,
    isConnecting: false,
    isLoading: false,
    error: null,
  });
  persistUser({
    isConnected: false,
    provider: null,
    username: null,
    primaryEmail: null,
    avatarUrl: null,
    membershipTier: null,
    membershipName: null,
  });
}
