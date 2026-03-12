import { create } from 'zustand';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from '@/lib/tauri/webAccountSession';
import {
  createCheckStatus,
  createHandleAuthCallback,
  createRequestEmailCode,
  createSignIn,
  createSignOut,
  createVerifyEmailCode,
} from './authActions';
import { createHydrateAvatar } from './avatarActions';
import { initialAccountSessionState, type AccountSessionStore } from './state';

export type { AccountProvider, AccountSessionActions, AccountSessionState } from './state';
export { ACCOUNT_USER_PERSIST_KEY } from './state';

export const useAccountSessionStore = create<AccountSessionStore>((set, get) => ({
  ...initialAccountSessionState,
  checkStatus: createCheckStatus(set, get),
  signIn: createSignIn(set, get),
  requestEmailCode: createRequestEmailCode(set, get),
  verifyEmailCode: createVerifyEmailCode(set, get),
  handleAuthCallback: createHandleAuthCallback(set, get),
  signOut: createSignOut(set, get),
  clearError: () => set({ error: null }),
  cancelConnect: () => set({ isConnecting: false, error: null }),
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
      localAvatarUrl: null,
      isConnecting: false,
      isLoading: false,
      error: null,
    });
  });

  invalidationListenerRegistered = true;
}

registerAccountAuthInvalidationListener();
