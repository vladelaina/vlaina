import type { StoreApi } from 'zustand';
import type { GithubSyncState, GithubSyncActions } from './state';
import { getLocalAvatarUrl } from '@/lib/assets/avatarManager';

type Set = StoreApi<GithubSyncState & GithubSyncActions>['setState'];
type Get = StoreApi<GithubSyncState & GithubSyncActions>['getState'];

export function createHydrateAvatar(set: Set, get: Get): () => Promise<void> {
  return async () => {
    const { username } = get();
    if (username) {
      const localSrc = await getLocalAvatarUrl(username);
      if (localSrc) {
        set({ localAvatarUrl: localSrc });
      }
    }
  };
}
