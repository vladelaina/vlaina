import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudRepoRuntimeTreeAccess } from './runtimeTreeAccess';
import {
  createCloudRepoStoreHarness,
  createDraftRecord,
  createFileRecord,
  createFolderNode,
  createRepository,
  createTreeEntry,
} from './testUtils';

const { githubRepoCommandsMock } = vi.hoisted(() => ({
  githubRepoCommandsMock: {
    getRepoTreeRecursive: vi.fn(),
    getFileContent: vi.fn(),
  },
}));

vi.mock('@/lib/tauri/githubRepoCommands', () => ({
  githubRepoCommands: githubRepoCommandsMock,
}));

describe('cloud repo runtime tree access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshRepositoryTree rebuilds the visible tree, applies drafts, and marks it loaded', async () => {
    const repository = createRepository();
    const draft = createDraftRecord(repository.id, 'docs/draft.md', 'dirty');
    const { state, get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[draft.logicalPath, draft]]),
      repoTrees: new Map([
        [repository.id, [createFolderNode('docs', [], { expanded: true })]],
      ]),
    });
    const runtimeDeps = {
      persistRepository: vi.fn(),
      getRepository: vi.fn(() => repository),
      hydrateRepository: vi.fn(async () => undefined),
    };
    githubRepoCommandsMock.getRepoTreeRecursive.mockResolvedValue([
      createTreeEntry('docs', 'dir'),
      createTreeEntry('docs/a.md'),
      createTreeEntry('docs/.nekotick.keep'),
      createTreeEntry('docs/image.png'),
    ]);
    const runtime = createCloudRepoRuntimeTreeAccess(set, get, runtimeDeps);

    await runtime.refreshRepositoryTree(repository.id);

    const docsNode = state.repoTrees.get(repository.id)?.[0];
    expect(docsNode).toMatchObject({
      path: 'docs',
      kind: 'folder',
      expanded: true,
    });
    expect(docsNode?.children?.map((node) => node.path)).toEqual([
      'docs/a.md',
      'docs/draft.md',
    ]);
    expect(state.loadedRepoTrees.has(repository.id)).toBe(true);
    expect(runtimeDeps.persistRepository).toHaveBeenCalledWith(repository.id);
  });

  it('ensureRepositoryTree hydrates first and skips refresh when the tree is already loaded', async () => {
    const repository = createRepository();
    const { get, set } = createCloudRepoStoreHarness({
      loadedRepoTrees: new Set([repository.id]),
    });
    const runtimeDeps = {
      persistRepository: vi.fn(),
      getRepository: vi.fn(() => repository),
      hydrateRepository: vi.fn(async () => undefined),
    };
    const runtime = createCloudRepoRuntimeTreeAccess(set, get, runtimeDeps);

    const result = await runtime.ensureRepositoryTree(repository.id);

    expect(result).toEqual(repository);
    expect(runtimeDeps.hydrateRepository).toHaveBeenCalledWith(repository.id);
    expect(githubRepoCommandsMock.getRepoTreeRecursive).not.toHaveBeenCalled();
  });

  it('readFileContent returns cached content without hitting the remote API', async () => {
    const repository = createRepository();
    const cached = createFileRecord(repository.id, 'docs/note.md', {
      content: '# cached',
      sha: 'cache-sha',
    });
    const { get, set } = createCloudRepoStoreHarness({
      fileCache: new Map([[cached.logicalPath, cached]]),
    });
    const runtime = createCloudRepoRuntimeTreeAccess(set, get, {
      persistRepository: vi.fn(),
      getRepository: vi.fn(() => repository),
      hydrateRepository: vi.fn(async () => undefined),
    });

    const result = await runtime.readFileContent(repository, 'docs/note.md');

    expect(result).toEqual({ content: '# cached', sha: 'cache-sha' });
    expect(githubRepoCommandsMock.getFileContent).not.toHaveBeenCalled();
  });

  it('readFileContent caches remote content after fetching it', async () => {
    const repository = createRepository();
    const { state, get, set } = createCloudRepoStoreHarness();
    githubRepoCommandsMock.getFileContent.mockResolvedValue({
      path: 'docs/note.md',
      content: '# remote',
      sha: 'remote-sha',
      encoding: 'base64',
    });
    const runtime = createCloudRepoRuntimeTreeAccess(set, get, {
      persistRepository: vi.fn(),
      getRepository: vi.fn(() => repository),
      hydrateRepository: vi.fn(async () => undefined),
    });

    const result = await runtime.readFileContent(repository, 'docs/note.md');

    expect(result).toEqual({ content: '# remote', sha: 'remote-sha' });
    expect(state.fileCache.size).toBe(1);
    expect(state.fileCache.values().next().value).toMatchObject({
      relativePath: 'docs/note.md',
      content: '# remote',
      sha: 'remote-sha',
    });
  });

  it('getRecursiveEntries stores a friendly error when the remote lookup fails', async () => {
    const repository = createRepository();
    const { state, get, set } = createCloudRepoStoreHarness();
    githubRepoCommandsMock.getRepoTreeRecursive.mockRejectedValue(new Error('404 not found'));
    const runtime = createCloudRepoRuntimeTreeAccess(set, get, {
      persistRepository: vi.fn(),
      getRepository: vi.fn(() => repository),
      hydrateRepository: vi.fn(async () => undefined),
    });

    const result = await runtime.getRecursiveEntries(repository);

    expect(result).toBeNull();
    expect(state.error).toBe('Repo not found');
  });
});
