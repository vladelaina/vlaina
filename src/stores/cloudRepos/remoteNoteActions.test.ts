import { describe, expect, it, vi } from 'vitest';
import { CLOUD_FOLDER_KEEP_FILE } from './pathOperations';
import { createCloudRepoRemoteNoteActions } from './remoteNoteActions';
import { CLOUD_REPO_SYNC_CONFLICT_ERROR } from './syncState';
import {
  createCloudRepoStoreHarness,
  createCommittedResult,
  createConflictResult,
  createDraftRecord,
  createFileRecord,
  createFileNode,
  createFolderNode,
  createRepository,
  createRuntimeMock,
  createTreeEntry,
} from './testUtils';

describe('cloud repo remote note actions', () => {
  it('openRemoteNote prefers draft content over cache and remote reads', async () => {
    const repository = createRepository();
    const draft = createDraftRecord(repository.id, 'docs/note.md', 'dirty', {
      content: '# draft',
      previousSha: 'draft-sha',
    });
    const { get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[draft.logicalPath, draft]]),
    });
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
    });
    const actions = createCloudRepoRemoteNoteActions(set, get, runtime);

    const snapshot = await actions.openRemoteNote(repository.id, 'docs/note.md');

    expect(snapshot).toMatchObject({
      relativePath: 'docs/note.md',
      content: '# draft',
      sha: 'draft-sha',
    });
    expect(runtime.readFileContent).not.toHaveBeenCalled();
    expect(runtime.persistRepository).not.toHaveBeenCalled();
  });

  it('openRemoteNote uses cached file content when no draft exists', async () => {
    const repository = createRepository();
    const cached = createFileRecord(repository.id, 'docs/note.md', {
      content: '# cached',
      sha: 'cache-sha',
    });
    const { get, set } = createCloudRepoStoreHarness({
      fileCache: new Map([[cached.logicalPath, cached]]),
    });
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
    });
    const actions = createCloudRepoRemoteNoteActions(set, get, runtime);

    const snapshot = await actions.openRemoteNote(repository.id, 'docs/note.md');

    expect(snapshot).toMatchObject({
      relativePath: 'docs/note.md',
      content: '# cached',
      sha: 'cache-sha',
    });
    expect(runtime.readFileContent).not.toHaveBeenCalled();
  });

  it('openRemoteNote reads and persists remote content when cache is empty', async () => {
    const repository = createRepository();
    const { get, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      readFileContent: vi.fn(async () => ({ content: '# remote', sha: 'remote-sha' })),
    });
    const actions = createCloudRepoRemoteNoteActions(set, get, runtime);

    const snapshot = await actions.openRemoteNote(repository.id, 'docs/note.md');

    expect(snapshot).toMatchObject({
      relativePath: 'docs/note.md',
      content: '# remote',
      sha: 'remote-sha',
    });
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
  });

  it('createRemoteNote uses tree and draft paths to generate a unique file name', async () => {
    const repository = createRepository();
    const draft = createDraftRecord(repository.id, 'docs/Untitled 2.md');
    const saveDraft = vi.fn(async () => undefined);
    const { get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[draft.logicalPath, draft]]),
      repoTrees: new Map([
        [
          repository.id,
          [createFolderNode('docs', [createFileNode('docs/Untitled.md')], { expanded: true })],
        ],
      ]),
      saveDraft,
    });
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
    });
    const actions = createCloudRepoRemoteNoteActions(set, get, runtime);

    const snapshot = await actions.createRemoteNote(repository.id, 'docs');

    expect(snapshot?.relativePath).toBe('docs/Untitled 3.md');
    expect(saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ relativePath: 'docs/Untitled 3.md' })
    );
  });

  it('createRemoteFolder stores a keep file and refreshes the tree after success', async () => {
    const repository = createRepository();
    const { state, get, set } = createCloudRepoStoreHarness({
      repoTrees: new Map([
        [
          repository.id,
          [createFolderNode('docs', [createFileNode('docs/New Folder')])],
        ],
      ]),
      syncStatus: new Map([[repository.id, 'has_changes']]),
    });
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [
        createTreeEntry('docs', 'dir'),
        createTreeEntry(`docs/existing/${CLOUD_FOLDER_KEEP_FILE}`),
      ]),
      runChangeset: vi.fn(async () => createCommittedResult()),
    });
    const actions = createCloudRepoRemoteNoteActions(set, get, runtime);

    const result = await actions.createRemoteFolder(repository.id, 'docs');

    expect(result).toBe('docs/New Folder 2');
    expect(runtime.runChangeset).toHaveBeenCalledWith(
      repository,
      [
        {
          operationType: 'upsert',
          path: `docs/New Folder 2/${CLOUD_FOLDER_KEEP_FILE}`,
          content: '',
          previousSha: null,
        },
      ],
      'create folder: docs/New Folder 2'
    );
    expect(state.syncStatus.get(repository.id)).toBe('synced');
    expect(runtime.refreshRepositoryTree).toHaveBeenCalledWith(repository.id);
  });

  it('createRemoteFolder propagates repository conflict state on changeset conflict', async () => {
    const repository = createRepository();
    const { state, get, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [createTreeEntry('docs', 'dir')]),
      runChangeset: vi.fn(async () => createConflictResult(['docs/New Folder/.nekotick.keep'])),
    });
    const actions = createCloudRepoRemoteNoteActions(set, get, runtime);

    const result = await actions.createRemoteFolder(repository.id, 'docs');

    expect(result).toBeNull();
    expect(state.syncStatus.get(repository.id)).toBe('error');
    expect(state.error).toBe(CLOUD_REPO_SYNC_CONFLICT_ERROR);
  });
});
