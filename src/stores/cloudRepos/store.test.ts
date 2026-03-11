import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepositoryInfo } from '@/lib/tauri/githubRepoCommands';

const {
  githubRepoCommandsMock,
  loadCloudRepoStateMock,
  scheduleCloudRepoStateSaveMock,
} = vi.hoisted(() => ({
  githubRepoCommandsMock: {
    listRepos: vi.fn<() => Promise<RepositoryInfo[]>>(),
    getRepoTree: vi.fn(),
    getRepoTreeRecursive: vi.fn(),
    getFileContent: vi.fn(),
    updateFile: vi.fn(),
    commitChangeset: vi.fn(),
    createRepo: vi.fn(),
    deleteFile: vi.fn(),
  },
  loadCloudRepoStateMock: vi.fn(),
  scheduleCloudRepoStateSaveMock: vi.fn(),
}));

vi.mock('@/lib/tauri/githubRepoCommands', () => ({
  githubRepoCommands: githubRepoCommandsMock,
}));

vi.mock('./persistence', () => ({
  loadCloudRepoState: loadCloudRepoStateMock,
  scheduleCloudRepoStateSave: scheduleCloudRepoStateSaveMock,
}));

import { useGithubReposStore } from './store';

function createRepository(overrides: Partial<RepositoryInfo> = {}): RepositoryInfo {
  return {
    id: 1,
    name: 'repo',
    displayName: 'repo',
    fullName: 'owner/repo',
    owner: 'owner',
    private: true,
    htmlUrl: 'https://example.test/owner/repo',
    defaultBranch: 'main',
    updatedAt: '2026-03-10T00:00:00Z',
    description: null,
    ...overrides,
  };
}

function resetStore(): void {
  useGithubReposStore.setState({
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
  });
}

describe('cloud repo store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('refreshes a persisted empty repository tree only once per session', async () => {
    const repository = createRepository();
    githubRepoCommandsMock.listRepos.mockResolvedValue([repository]);
    githubRepoCommandsMock.getRepoTreeRecursive.mockResolvedValue([]);
    loadCloudRepoStateMock.mockResolvedValue({
      tree: [],
      files: [],
      drafts: [],
      lastSyncedAt: null,
    });

    await useGithubReposStore.getState().loadRepositories();
    await useGithubReposStore.getState().toggleRepoExpanded(repository.id);

    expect(githubRepoCommandsMock.getRepoTreeRecursive).toHaveBeenCalledTimes(1);
    expect(useGithubReposStore.getState().loadedRepoTrees.has(repository.id)).toBe(true);

    await useGithubReposStore.getState().toggleRepoExpanded(repository.id);
    await useGithubReposStore.getState().toggleRepoExpanded(repository.id);

    expect(githubRepoCommandsMock.getRepoTreeRecursive).toHaveBeenCalledTimes(1);
  });

  it('clears loaded tree state when a repository is removed', async () => {
    const repository = createRepository();
    githubRepoCommandsMock.listRepos.mockResolvedValue([repository]);
    githubRepoCommandsMock.getRepoTreeRecursive.mockResolvedValue([]);
    loadCloudRepoStateMock.mockResolvedValue(null);

    await useGithubReposStore.getState().loadRepositories();
    await useGithubReposStore.getState().toggleRepoExpanded(repository.id);

    expect(useGithubReposStore.getState().loadedRepoTrees.has(repository.id)).toBe(true);

    useGithubReposStore.getState().removeRepository(repository.id);

    expect(useGithubReposStore.getState().loadedRepoTrees.has(repository.id)).toBe(false);
  });
});
