import { create } from 'zustand';
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
