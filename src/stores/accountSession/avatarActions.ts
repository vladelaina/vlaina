import type { StoreApi } from 'zustand';
import type { AccountSessionActions, AccountSessionState } from './state';
import { getLocalAvatarUrl } from '@/lib/assets/avatarManager';

type Set = StoreApi<AccountSessionState & AccountSessionActions>['setState'];
type Get = StoreApi<AccountSessionState & AccountSessionActions>['getState'];

export function createHydrateAvatar(set: Set, get: Get): () => Promise<void> {
  return async () => {
    const { username } = get();
    if (!username) {
      set({ localAvatarUrl: null });
      return;
    }

    const localSrc = await getLocalAvatarUrl(username);
    set({ localAvatarUrl: localSrc || null });
  };
}
