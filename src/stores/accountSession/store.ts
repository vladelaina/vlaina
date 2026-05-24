import { create } from 'zustand';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from '@/lib/account/sessionEvent';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import {
  createCheckStatus,
  createCancelConnect,
  createHandleAuthCallback,
  createRequestEmailCode,
  createSignIn,
  createSignOut,
  createVerifyEmailCode,
} from './authActions';
import {
  ACCOUNT_USER_BROADCAST_CHANNEL,
  ACCOUNT_USER_BROADCAST_TYPE,
  loadPersistedUser,
  normalizePersistedUser,
} from './authSupport';
import { createHydrateAvatar } from './avatarActions';
import {
  ACCOUNT_USER_PERSIST_KEY,
  initialAccountSessionState,
  type AccountSessionStore,
} from './state';

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
let persistenceListenerRegistered = false;
let broadcastListenerRegistered = false;
let accountBroadcastChannel: BroadcastChannel | null = null;

function registerAccountAuthInvalidationListener(): void {
  if (invalidationListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener(ACCOUNT_AUTH_INVALIDATED_EVENT, () => {
    useManagedAIStore.getState().clearBudget();
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
      hasCheckedStatus: true,
      error: null,
    });
  });

  invalidationListenerRegistered = true;
}

function registerAccountPersistenceListener(): void {
  if (persistenceListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== ACCOUNT_USER_PERSIST_KEY) {
      return;
    }

    const identity = loadPersistedUser();
    if (identity.isConnected !== true) {
      useManagedAIStore.getState().clearBudget();
    }

    useAccountSessionStore.setState({
      ...initialAccountSessionState,
      ...identity,
      isLoading: false,
      hasCheckedStatus: false,
      error: null,
    });
    void useAccountSessionStore.getState().hydrateAvatar();
  });

  persistenceListenerRegistered = true;
}

function applyPersistedAccountIdentity(identity: Partial<AccountSessionStore>): void {
  if (identity.isConnected !== true) {
    useManagedAIStore.getState().clearBudget();
  }

  useAccountSessionStore.setState({
    ...initialAccountSessionState,
    ...identity,
    isLoading: false,
    hasCheckedStatus: false,
    error: null,
  });
  void useAccountSessionStore.getState().hydrateAvatar();
}

function registerAccountBroadcastListener(): void {
  if (broadcastListenerRegistered || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return;
  }

  try {
    accountBroadcastChannel = new BroadcastChannel(ACCOUNT_USER_BROADCAST_CHANNEL);
    accountBroadcastChannel.addEventListener('message', (event) => {
      const payload = event.data as { type?: unknown; identity?: unknown } | null;
      if (!payload || payload.type !== ACCOUNT_USER_BROADCAST_TYPE) {
        return;
      }

      applyPersistedAccountIdentity(normalizePersistedUser(payload.identity));
    });
    broadcastListenerRegistered = true;
  } catch {
    accountBroadcastChannel?.close();
    accountBroadcastChannel = null;
  }
}

registerAccountAuthInvalidationListener();
registerAccountPersistenceListener();
registerAccountBroadcastListener();
