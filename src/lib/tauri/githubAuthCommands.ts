import { safeInvoke } from './invoke';

export const githubCommands = {
  async getGithubSyncStatus() {
    return safeInvoke<{
      connected: boolean;
      username: string | null;
      avatarUrl: string | null;
      configRepoReady: boolean;
      lastSyncTime: number | null;
      hasRemoteData: boolean;
      remoteModifiedTime: string | null;
    }>('get_github_sync_status', undefined, {
      webFallback: {
        connected: false,
        username: null,
        avatarUrl: null,
        configRepoReady: false,
        lastSyncTime: null,
        hasRemoteData: false,
        remoteModifiedTime: null,
      },
    });
  },

  async githubAuth() {
    return safeInvoke<{
      success: boolean;
      username: string | null;
      error: string | null;
    }>('github_auth', undefined, {
      webFallback: {
        success: false,
        username: null,
        error: 'GitHub sync is not available on web platform',
      },
    });
  },

  async githubDisconnect() {
    return safeInvoke('github_disconnect');
  },

  async syncToGithub() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('sync_config_to_github', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async restoreFromGithub() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('restore_config_from_github', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Restore is not available on web platform',
      },
    });
  },

  async syncGithubBidirectional() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      pulledFromCloud: boolean;
      pushedToCloud: boolean;
      error: string | null;
    }>('sync_config_bidirectional', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        pulledFromCloud: false,
        pushedToCloud: false,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async checkGithubRemoteData() {
    return safeInvoke<{
      exists: boolean;
      modifiedTime: string | null;
    }>('check_config_remote_data', undefined, {
      webFallback: {
        exists: false,
        modifiedTime: null,
      },
    });
  },

};
