import { create } from 'zustand';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from '@/lib/account/sessionEvent';
import {
  createCheckStatus,
  createCancelConnect,
  createHandleAuthCallback,
  createRequestEmailCode,
  createSignIn,
  createSignOut,
  createVerifyEmailCode,
} from './authActions';
import { loadPersistedUser } from './authSupport';
import { createHydrateAvatar } from './avatarActions';
import { initialAccountSessionState, type AccountSessionStore } from './state';

export type { AccountProvider, AccountSessionActions, AccountSessionState } from './state';
export { ACCOUNT_USER_PERSIST_KEY } from './state';

const persistedUser = loadPersistedUser();

export const useAccountSessionStore = create<AccountSessionStore>((set, get) => ({
  ...initialAccountSessionState,
  ...persistedUser,
  checkStatus: createCheckStatus(set, get),
  signIn: createSignIn(set, get),
  requestEmailCode: createRequestEmailCode(set, get),
  verifyEmailCode: createVerifyEmailCode(set, get),
  handleAuthCallback: createHandleAuthCallback(set, get),
  signOut: createSignOut(set, get),
  clearError: () => set({ error: null }),
  cancelConnect: createCancelConnect(set, get),
  hydrateAvatar: createHydrateAvatar(set, get),
}));

let invalidationListenerRegistered = false;

function registerAccountAuthInvalidationListener(): void {
  if (invalidationListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener(ACCOUNT_AUTH_INVALIDATED_EVENT, () => {
    useAccountSessionStore.setState({
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
  });

  invalidationListenerRegistered = true;
}

registerAccountAuthInvalidationListener();
