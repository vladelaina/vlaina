import { vi } from 'vitest';
import type {
  RepoChangesetCommitResult,
  RepositoryInfo,
  TreeEntry,
} from '@/lib/tauri/githubRepoCommands';
import { createCloudNoteLogicalPath } from './ids';
import type { CloudRepoGet, CloudRepoSet } from './storeSupport';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import type {
  CloudRepoDraftRecord,
  CloudRepoFileRecord,
  CloudRepoNode,
  CloudRepoStore,
} from './types';

export function createRepository(
  overrides: Partial<RepositoryInfo> = {}
): RepositoryInfo {
  return {
    id: 1,
    name: 'nekotick-repo',
    displayName: 'repo',
    fullName: 'owner/nekotick-repo',
    owner: 'owner',
    private: true,
    htmlUrl: 'https://example.test/owner/nekotick-repo',
    defaultBranch: 'main',
    updatedAt: '2026-03-10T00:00:00Z',
    description: null,
    ...overrides,
  };
}

export function createDraftRecord(
  repositoryId: number,
  relativePath: string,
  state: CloudRepoDraftRecord['state'] = 'dirty',
  overrides: Partial<CloudRepoDraftRecord> = {}
): CloudRepoDraftRecord {
  const branch = overrides.branch ?? 'main';
  return {
    logicalPath: createCloudNoteLogicalPath(repositoryId, branch, relativePath),
    repositoryId,
    owner: 'owner',
    repo: 'repo',
    branch,
    relativePath,
    content: '',
    previousSha: null,
    updatedAt: 1,
    state,
    ...overrides,
  };
}

export function createFileRecord(
  repositoryId: number,
  relativePath: string,
  overrides: Partial<CloudRepoFileRecord> = {}
): CloudRepoFileRecord {
  const branch = overrides.branch ?? 'main';
  return {
    logicalPath: createCloudNoteLogicalPath(repositoryId, branch, relativePath),
    repositoryId,
    owner: 'owner',
    repo: 'repo',
    branch,
    relativePath,
    content: '',
    sha: null,
    updatedAt: 1,
    ...overrides,
  };
}

export function createFileNode(
  path: string,
  overrides: Partial<CloudRepoNode> = {}
): CloudRepoNode {
  return {
    path,
    name: path.split('/').pop() ?? path,
    kind: 'file',
    sha: null,
    expanded: false,
    ...overrides,
  };
}

export function createFolderNode(
  path: string,
  children: CloudRepoNode[] = [],
  overrides: Partial<CloudRepoNode> = {}
): CloudRepoNode {
  return {
    path,
    name: path.split('/').pop() ?? path,
    kind: 'folder',
    sha: null,
    expanded: false,
    children,
    ...overrides,
  };
}

export function createTreeEntry(
  path: string,
  entryType: TreeEntry['entryType'] = 'file',
  overrides: Partial<TreeEntry> = {}
): TreeEntry {
  return {
    path,
    name: path.split('/').pop() ?? path,
    entryType,
    sha: `sha:${path}`,
    ...overrides,
  };
}

export function createCommittedResult(
  updatedFiles: RepoChangesetCommitResult['updatedFiles'] = []
): RepoChangesetCommitResult {
  return {
    status: 'committed',
    commit: {
      sha: 'commit-sha',
      message: 'sync',
    },
    conflicts: [],
    updatedFiles,
  };
}

export function createConflictResult(
  paths: string[]
): RepoChangesetCommitResult {
  return {
    status: 'conflict',
    commit: null,
    conflicts: paths.map((path) => ({
      path,
      reason: 'modified' as const,
    })),
    updatedFiles: [],
  };
}

export function createCloudRepoStoreHarness(
  overrides: Partial<CloudRepoStore> = {}
): {
  state: CloudRepoStore;
  get: CloudRepoGet;
  set: CloudRepoSet;
} {
  const state: CloudRepoStore = {
    repositories: [],
    isLoadingRepos: false,
    expandedRepos: new Set(),
    repoTrees: new Map(),
    loadedRepoTrees: new Set(),
    fileCache: new Map(),
    drafts: new Map(),
    syncStatus: new Map(),
    error: null,
    sectionExpanded: false,
    hydratedRepos: new Set(),
    loadRepositories: async () => undefined,
    createRepository: async () => null,
    removeRepository: () => undefined,
    toggleRepoExpanded: async () => undefined,
    toggleFolder: async () => undefined,
    openRemoteNote: async () => null,
    createRemoteNote: async () => null,
    createRemoteFolder: async () => null,
    renameRemoteNode: async () => null,
    deleteRemoteNode: async () => false,
    saveDraft: async () => undefined,
    syncRepository: async () => null,
    getRepoNodes: () => [],
    getDraftCounts: () => ({ dirty: 0, conflict: 0 }),
    getFileState: () => undefined,
    hasChanges: () => false,
    clearError: () => undefined,
    toggleSectionExpanded: () => undefined,
    ...overrides,
  };

  const set = ((partial: unknown) => {
    const nextState =
      typeof partial === 'function'
        ? partial(state)
        : partial;

    if (!nextState || typeof nextState !== 'object') {
      return state;
    }

    Object.assign(state, nextState);
    return state;
  }) as CloudRepoSet;

  const get = (() => state) as CloudRepoGet;

  return { state, get, set };
}

export function createRuntimeMock(
  overrides: Partial<CloudRepoStoreRuntime> = {}
): CloudRepoStoreRuntime {
  return {
    persistRepository: vi.fn(),
    getRepository: vi.fn(() => null),
    buildSnapshot: vi.fn((repository, relativePath, content, sha) => ({
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
      branch: repository.defaultBranch,
      relativePath,
      logicalPath: createCloudNoteLogicalPath(
        repository.id,
        repository.defaultBranch,
        relativePath
      ),
      content,
      sha,
    })),
    hydrateRepository: vi.fn(async () => undefined),
    scheduleAutoSync: vi.fn(),
    refreshRepositoryTree: vi.fn(async () => undefined),
    ensureRepositoryTree: vi.fn(async () => null),
    readFileContent: vi.fn(async () => null),
    ensureCleanRepository: vi.fn(async () => true),
    runChangeset: vi.fn(async () => createCommittedResult()),
    getRecursiveEntries: vi.fn(async () => null),
    ...overrides,
  };
}
