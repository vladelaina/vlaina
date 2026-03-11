import { describe, expect, it, vi } from 'vitest';
import { createCloudRepoRepositoryActions } from './repositoryActions';
import { createDraftRecord, createRepository, createRuntimeMock, createCloudRepoStoreHarness, createFolderNode } from './testUtils';

const { githubRepoCommandsMock } = vi.hoisted(() => ({
  githubRepoCommandsMock: {
    listRepos: vi.fn(),
    createRepo: vi.fn(),
  },
}));

vi.mock('@/lib/tauri/githubRepoCommands', () => ({
  githubRepoCommands: githubRepoCommandsMock,
}));

describe('cloud repo repository actions', () => {
  it('loadRepositories hydrates every returned repository', async () => {
    const first = createRepository({ id: 1, name: 'nekotick-one' });
    const second = createRepository({ id: 2, name: 'nekotick-two' });
    const { state, get, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      hydrateRepository: vi.fn(async () => undefined),
    });
    githubRepoCommandsMock.listRepos.mockResolvedValue([first, second]);
    const actions = createCloudRepoRepositoryActions(set, get, runtime);

    await actions.loadRepositories();

    expect(state.repositories).toEqual([first, second]);
    expect(runtime.hydrateRepository).toHaveBeenCalledWith(1);
    expect(runtime.hydrateRepository).toHaveBeenCalledWith(2);
    expect(state.isLoadingRepos).toBe(false);
  });

  it('loadRepositories keeps only managed content repositories', async () => {
    const first = createRepository({ id: 1, name: 'nekotick-one' });
    const second = createRepository({ id: 2, name: 'other' });
    const third = createRepository({ id: 3, name: 'nekotick-config' });
    const { state, get, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      hydrateRepository: vi.fn(async () => undefined),
    });
    githubRepoCommandsMock.listRepos.mockResolvedValue([first, second, third]);
    const actions = createCloudRepoRepositoryActions(set, get, runtime);

    await actions.loadRepositories();

    expect(state.repositories).toEqual([first]);
    expect(runtime.hydrateRepository).toHaveBeenCalledWith(1);
    expect(runtime.hydrateRepository).not.toHaveBeenCalledWith(2);
    expect(runtime.hydrateRepository).not.toHaveBeenCalledWith(3);
    expect(state.isLoadingRepos).toBe(false);
  });

  it('createRepository prepends the new repository and initializes sync status', async () => {
    const repository = createRepository({
      id: 9,
      name: 'nekotick-new-repo',
      displayName: 'new-repo',
      fullName: 'owner/nekotick-new-repo',
      htmlUrl: 'https://example.test/owner/nekotick-new-repo',
    });
    const { state, get, set } = createCloudRepoStoreHarness({
      repositories: [
        createRepository({
          id: 1,
          name: 'nekotick-old-repo',
          displayName: 'old-repo',
          fullName: 'owner/nekotick-old-repo',
          htmlUrl: 'https://example.test/owner/nekotick-old-repo',
        }),
      ],
    });
    githubRepoCommandsMock.createRepo.mockResolvedValue(repository);
    const actions = createCloudRepoRepositoryActions(set, get, createRuntimeMock());

    const result = await actions.createRepository('new-repo', true);

    expect(result).toEqual(repository);
    expect(state.repositories[0]).toEqual(repository);
    expect(state.syncStatus.get(repository.id)).toBe('synced');
  });

  it('toggleFolder updates the tree and persists expansion state', async () => {
    const repository = createRepository();
    const tree = [createFolderNode('docs', [], { expanded: false })];
    const { state, get, set } = createCloudRepoStoreHarness({
      repoTrees: new Map([[repository.id, tree]]),
    });
    const runtime = createRuntimeMock({
      hydrateRepository: vi.fn(async () => undefined),
    });
    const actions = createCloudRepoRepositoryActions(set, get, runtime);

    await actions.toggleFolder(repository.id, 'docs');

    expect(state.repoTrees.get(repository.id)?.[0]).toMatchObject({ expanded: true });
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
  });

  it('hasChanges and getDraftCounts reflect dirty and conflict drafts for a repository', () => {
    const repository = createRepository();
    const draft = createDraftRecord(repository.id, 'docs/a.md', 'dirty');
    const conflict = createDraftRecord(repository.id, 'docs/b.md', 'conflict');
    const { get, set } = createCloudRepoStoreHarness({
      drafts: new Map([
        [draft.logicalPath, draft],
        [conflict.logicalPath, conflict],
      ]),
    });
    const actions = createCloudRepoRepositoryActions(set, get, createRuntimeMock());

    expect(actions.getDraftCounts(repository.id)).toEqual({ dirty: 1, conflict: 1 });
    expect(actions.hasChanges(repository.id)).toBe(true);
  });
});
