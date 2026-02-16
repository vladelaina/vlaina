import { safeInvoke } from './invoke';

export interface FileStatus {
  path: string;
  status: 'new' | 'modified' | 'deleted' | 'renamed' | 'untracked';
}

export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
}

export const gitCommands = {
  async cloneRepo(owner: string, repo: string): Promise<string | null> {
    const result = await safeInvoke<string>('clone_github_repo', { owner, repo }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async isRepoCloned(owner: string, repo: string): Promise<boolean> {
    const result = await safeInvoke<boolean>('is_repo_cloned', { owner, repo }, {
      webFallback: false,
    });
    return result || false;
  },

  async getRepoLocalPath(owner: string, repo: string): Promise<string | null> {
    const result = await safeInvoke<string>('get_repo_local_path', { owner, repo }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async pullRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('pull_github_repo', { owner, repo });
  },

  async pushRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('push_github_repo', { owner, repo });
  },

  async commitChanges(
    owner: string,
    repo: string,
    message: string
  ): Promise<string | null> {
    const result = await safeInvoke<string>('commit_repo_changes', {
      owner,
      repo,
      message,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async getStatus(owner: string, repo: string): Promise<FileStatus[]> {
    const result = await safeInvoke<FileStatus[]>('get_repo_status', { owner, repo }, {
      webFallback: [],
    });
    return result || [];
  },

  async getLog(owner: string, repo: string, limit?: number): Promise<CommitInfo[]> {
    const result = await safeInvoke<CommitInfo[]>('get_repo_log', { owner, repo, limit }, {
      webFallback: [],
    });
    return result || [];
  },

  async getFileDiff(owner: string, repo: string, filePath: string): Promise<string> {
    const result = await safeInvoke<string>('get_file_diff', { owner, repo, filePath }, {
      webFallback: '',
    });
    return result || '';
  },

  async syncRepo(owner: string, repo: string, message: string): Promise<void> {
    await safeInvoke('sync_github_repo', { owner, repo, message });
  },

  async deleteLocalRepo(owner: string, repo: string): Promise<void> {
    await safeInvoke('delete_local_repo', { owner, repo });
  },

  async listLocalRepos(): Promise<Array<[string, string]>> {
    const result = await safeInvoke<Array<[string, string]>>('list_local_repos', undefined, {
      webFallback: [],
    });
    return result || [];
  },
};
