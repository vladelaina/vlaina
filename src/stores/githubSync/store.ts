import { create } from 'zustand';
import { GITHUB_AUTH_INVALIDATED_EVENT } from '@/lib/tauri/webGithubSession';
import {
  createCheckStatus,
  createConnect,
  createHandleOAuthCallback,
  createDisconnect,
  createCancelConnect,
} from './authActions';
import { createHydrateAvatar } from './avatarActions';
import {
  initialGithubSyncState,
  type GithubSyncStore,
} from './state';
import { createGithubConfigSyncActions } from './configActions';

export type { GithubSyncActions, GithubSyncState, GithubSyncStatusType } from './state';
export { GITHUB_USER_PERSIST_KEY } from './state';

export const useGithubSyncStore = create<GithubSyncStore>((set, get) => ({
  ...initialGithubSyncState,

  checkStatus: createCheckStatus(set, get),
  connect: createConnect(set, get),
  handleOAuthCallback: createHandleOAuthCallback(set, get),
  disconnect: createDisconnect(set, get),
  cancelConnect: createCancelConnect(set, get),
  hydrateAvatar: createHydrateAvatar(set, get),
  ...createGithubConfigSyncActions(set, get),
}));

let invalidationListenerRegistered = false;

function registerGithubAuthInvalidationListener(): void {
  if (invalidationListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener(GITHUB_AUTH_INVALIDATED_EVENT, () => {
    useGithubSyncStore.setState({
      isConnected: false,
      username: null,
      avatarUrl: null,
      localAvatarUrl: null,
      configRepoReady: false,
      isConnecting: false,
      isSyncing: false,
      lastSyncTime: null,
      syncError: null,
      hasRemoteData: false,
      remoteModifiedTime: null,
      isLoading: false,
      syncStatus: 'idle',
    });
  });

  invalidationListenerRegistered = true;
}

registerGithubAuthInvalidationListener();
