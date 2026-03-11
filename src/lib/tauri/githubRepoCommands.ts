import { isTauri } from '@/lib/storage/adapter';
import {
  assertManagedContentRepoName,
  filterManagedContentRepositories,
  normalizeManagedContentRepoName,
} from './githubManagedRepoPolicy';
import { safeInvoke } from './invoke';
import { webGithubCommands } from './webGithubCommands';

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

export interface RepoChangeOperation {
  operationType: 'upsert' | 'delete';
  path: string;
  content?: string;
  previousSha?: string | null;
}

export interface RepoCommitConflict {
  path: string;
  reason: 'modified' | 'deleted' | 'created';
}

export interface RepoCommittedFile {
  path: string;
  sha: string;
}

export interface RepoChangesetCommitResult {
  status: 'committed' | 'conflict';
  commit: CommitResult | null;
  conflicts: RepoCommitConflict[];
  updatedFiles: RepoCommittedFile[];
}

export const githubRepoCommands = {
  async listRepos(): Promise<RepositoryInfo[]> {
    if (!isTauri()) {
      return filterManagedContentRepositories(await webGithubCommands.listRepos());
    }
    const result = await safeInvoke<RepositoryInfo[]>('list_github_repos', undefined, {
      webFallback: [],
    });
    return filterManagedContentRepositories(result || []);
  },

  async getRepoTreeRecursive(owner: string, repo: string, branch: string): Promise<TreeEntry[]> {
    assertManagedContentRepoName(repo);
    if (!isTauri()) {
      return webGithubCommands.getRepoTreeRecursive(owner, repo, branch);
    }
    const result = await safeInvoke<TreeEntry[]>(
      'get_repo_tree_recursive',
      { owner, repo, branch },
      {
        webFallback: [],
      }
    );
    return result || [];
  },

  async getFileContent(owner: string, repo: string, path: string): Promise<FileContent | null> {
    assertManagedContentRepoName(repo);
    if (!isTauri()) {
      return webGithubCommands.getFileContent(owner, repo, path);
    }
    const result = await safeInvoke<FileContent>('get_repo_file_content', { owner, repo, path }, {
      webFallback: undefined,
    });
    return result || null;
  },

  async commitChangeset(
    owner: string,
    repo: string,
    branch: string,
    message: string,
    operations: RepoChangeOperation[]
  ): Promise<RepoChangesetCommitResult> {
    assertManagedContentRepoName(repo);
    if (!isTauri()) {
      return webGithubCommands.commitChangeset(owner, repo, branch, message, operations);
    }
    const result = await safeInvoke<RepoChangesetCommitResult>(
      'commit_repo_changeset',
      { owner, repo, branch, message, operations },
      {
        webFallback: {
          status: 'conflict',
          commit: null,
          conflicts: [],
          updatedFiles: [],
        },
      }
    );
    return (
      result || {
        status: 'conflict',
        commit: null,
        conflicts: [],
        updatedFiles: [],
      }
    );
  },

  async createRepo(
    name: string,
    isPrivate: boolean,
    description?: string
  ): Promise<RepositoryInfo | null> {
    const normalizedName = normalizeManagedContentRepoName(name);
    assertManagedContentRepoName(normalizedName);
    if (!isTauri()) {
      return webGithubCommands.createRepo(normalizedName, isPrivate, description);
    }
    const result = await safeInvoke<RepositoryInfo>(
      'create_github_repo',
      {
        name: normalizedName,
        private: isPrivate,
        description,
      },
      {
        webFallback: undefined,
      }
    );
    return result ? filterManagedContentRepositories([result])[0] ?? null : null;
  },
};
