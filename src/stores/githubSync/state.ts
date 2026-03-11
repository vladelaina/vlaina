export type GithubSyncStatusType = 'idle' | 'pending' | 'syncing' | 'success' | 'error';

export interface GithubSyncState {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
  localAvatarUrl: string | null;
  configRepoReady: boolean;
  isSyncing: boolean;
  isConnecting: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  hasRemoteData: boolean;
  remoteModifiedTime: string | null;
  isLoading: boolean;
  syncStatus: GithubSyncStatusType;
}

export interface GithubSyncActions {
  checkStatus: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncToCloud: () => Promise<boolean>;
  syncBidirectional: () => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
  checkRemoteData: () => Promise<void>;
  clearError: () => void;
  cancelConnect: () => void;
  setSyncStatus: (status: GithubSyncStatusType) => void;
  handleOAuthCallback: () => Promise<boolean>;
  hydrateAvatar: () => Promise<void>;
}

export type GithubSyncStore = GithubSyncState & GithubSyncActions;

export const GITHUB_USER_PERSIST_KEY = 'nekotick_github_user_identity';

interface PersistedUser {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
  localAvatarUrl?: string | null;
}

function getPersistedUser(): PersistedUser {
  try {
    const stored = localStorage.getItem(GITHUB_USER_PERSIST_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load persisted GitHub user:', e);
  }
  return { isConnected: false, username: null, avatarUrl: null };
}

const persisted = getPersistedUser();

export const initialGithubSyncState: GithubSyncState = {
  isConnected: persisted.isConnected,
  username: persisted.username,
  avatarUrl: persisted.avatarUrl,
  localAvatarUrl: null,
  configRepoReady: false,
  isSyncing: false,
  isConnecting: false,
  lastSyncTime: null,
  syncError: null,
  hasRemoteData: false,
  remoteModifiedTime: null,
  isLoading: true,
  syncStatus: 'idle',
};
