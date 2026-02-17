import { safeInvoke } from './invoke';

export interface RepositoryInfo {
  id: number;
  name: string;
  displayName: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  updatedAt: string;
  description: string | null;
}

export interface TreeEntry {
  path: string;
  name: string;
  entryType: 'file' | 'dir';
  sha: string;
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  encoding: string;
}

export interface CommitResult {
  sha: string;
  message: string;
  htmlUrl?: string;
}

export const githubRepoCommands = {
  async listRepos(): Promise<RepositoryInfo[]> {
    const result = await safeInvoke<RepositoryInfo[]>('list_github_repos', undefined, {
      webFallback: [],
    });
    return result || [];
  },

  async getRepoTree(owner: string, repo: string, path: string = ''): Promise<TreeEntry[]> {
    const result = await safeInvoke<TreeEntry[]>('get_repo_tree', { owner, repo, path }, {
      webFallback: [],
    });
    return result || [];
  },

  async getFileContent(owner: string, repo: string, path: string): Promise<FileContent | null> {
    const result = await safeInvoke<FileContent>('get_repo_file_content', { owner, repo, path }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    sha: string | null,
    message: string
  ): Promise<CommitResult | null> {
    const result = await safeInvoke<CommitResult>('update_repo_file', {
      owner,
      repo,
      path,
      content,
      sha,
      message,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async createRepo(
    name: string,
    isPrivate: boolean,
    description?: string
  ): Promise<RepositoryInfo | null> {
    const result = await safeInvoke<RepositoryInfo>('create_github_repo', {
      name,
      private: isPrivate,
      description,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    message: string
  ): Promise<CommitResult | null> {
    const result = await safeInvoke<CommitResult>('delete_repo_file', {
      owner,
      repo,
      path,
      sha,
      message,
    }, {
      webFallback: undefined,
    });
    return result || null;
  },
};
