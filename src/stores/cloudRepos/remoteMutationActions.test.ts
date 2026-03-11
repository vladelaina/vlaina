import { describe, expect, it, vi } from 'vitest';
import { createCloudNoteLogicalPath } from './ids';
import { createCloudRepoRemoteMutationActions } from './remoteMutationActions';
import { CLOUD_REPO_SYNC_CONFLICT_ERROR } from './syncState';
import {
  createCloudRepoStoreHarness,
  createCommittedResult,
  createConflictResult,
  createDraftRecord,
  createFileRecord,
  createRepository,
  createRuntimeMock,
  createTreeEntry,
} from './testUtils';

describe('cloud repo remote mutation actions', () => {
  it('renameRemoteNode returns early when the target path does not change', async () => {
    const repository = createRepository();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
    });
    const { set } = createCloudRepoStoreHarness();
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.renameRemoteNode(repository.id, 'docs/note.md', 'file', 'note.md');

    expect(result).toBe('docs/note.md');
    expect(runtime.getRecursiveEntries).not.toHaveBeenCalled();
    expect(runtime.runChangeset).not.toHaveBeenCalled();
  });

  it('renameRemoteNode rejects duplicate destination paths', async () => {
    const repository = createRepository();
    const { state, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [
        createTreeEntry('docs/note.md'),
        createTreeEntry('docs/other.md'),
      ]),
    });
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.renameRemoteNode(repository.id, 'docs/note.md', 'file', 'other.md');

    expect(result).toBeNull();
    expect(state.error).toBe('A cloud note or folder with that name already exists');
    expect(runtime.runChangeset).not.toHaveBeenCalled();
  });

  it('renameRemoteNode stops when a source file cannot be read', async () => {
    const repository = createRepository();
    const { state, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [createTreeEntry('docs/note.md')]),
      readFileContent: vi.fn(async () => null),
    });
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.renameRemoteNode(repository.id, 'docs/note.md', 'file', 'renamed.md');

    expect(result).toBeNull();
    expect(state.error).toBe('Failed to read cloud repository file before rename');
  });

  it('renameRemoteNode remaps cached file records after a successful commit', async () => {
    const repository = createRepository();
    const cachedFile = createFileRecord(repository.id, 'docs/note.md', {
      content: '# note',
      sha: 'sha-old',
    });
    const { state, set } = createCloudRepoStoreHarness({
      fileCache: new Map([[cachedFile.logicalPath, cachedFile]]),
    });
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [createTreeEntry('docs/note.md', 'file', { sha: 'sha-old' })]),
      readFileContent: vi.fn(async () => ({ content: '# note', sha: 'sha-old' })),
      runChangeset: vi.fn(async () =>
        createCommittedResult([{ path: 'docs/renamed.md', sha: 'sha-new' }])
      ),
    });
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.renameRemoteNode(
      repository.id,
      'docs/note.md',
      'file',
      'renamed.md'
    );

    const nextLogicalPath = createCloudNoteLogicalPath(
      repository.id,
      repository.defaultBranch,
      'docs/renamed.md'
    );
    expect(result).toBe('docs/renamed.md');
    expect(state.fileCache.has(cachedFile.logicalPath)).toBe(false);
    expect(state.fileCache.get(nextLogicalPath)).toMatchObject({
      relativePath: 'docs/renamed.md',
      sha: 'sha-new',
    });
    expect(runtime.refreshRepositoryTree).toHaveBeenCalledWith(repository.id);
  });

  it('renameRemoteNode marks repository conflict state when commit conflicts', async () => {
    const repository = createRepository();
    const { state, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [createTreeEntry('docs/note.md', 'file', { sha: 'sha-old' })]),
      readFileContent: vi.fn(async () => ({ content: '# note', sha: 'sha-old' })),
      runChangeset: vi.fn(async () => createConflictResult(['docs/renamed.md'])),
    });
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.renameRemoteNode(repository.id, 'docs/note.md', 'file', 'renamed.md');

    expect(result).toBeNull();
    expect(state.syncStatus.get(repository.id)).toBe('error');
    expect(state.error).toBe(CLOUD_REPO_SYNC_CONFLICT_ERROR);
  });

  it('deleteRemoteNode removes nested cache and draft records after success', async () => {
    const repository = createRepository();
    const insideFile = createFileRecord(repository.id, 'docs/a.md');
    const outsideFile = createFileRecord(repository.id, 'other.md');
    const insideDraft = createDraftRecord(repository.id, 'docs/a.md');
    const outsideDraft = createDraftRecord(repository.id, 'other.md');
    const { state, set } = createCloudRepoStoreHarness({
      fileCache: new Map([
        [insideFile.logicalPath, insideFile],
        [outsideFile.logicalPath, outsideFile],
      ]),
      drafts: new Map([
        [insideDraft.logicalPath, insideDraft],
        [outsideDraft.logicalPath, outsideDraft],
      ]),
    });
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [
        createTreeEntry('docs/a.md', 'file', { sha: 'sha-a' }),
        createTreeEntry('other.md', 'file', { sha: 'sha-b' }),
      ]),
      runChangeset: vi.fn(async () => createCommittedResult()),
    });
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.deleteRemoteNode(repository.id, 'docs', 'folder');

    expect(result).toBe(true);
    expect(state.fileCache.has(insideFile.logicalPath)).toBe(false);
    expect(state.fileCache.has(outsideFile.logicalPath)).toBe(true);
    expect(state.drafts.has(insideDraft.logicalPath)).toBe(false);
    expect(state.drafts.has(outsideDraft.logicalPath)).toBe(true);
    expect(runtime.refreshRepositoryTree).toHaveBeenCalledWith(repository.id);
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
  });

  it('deleteRemoteNode marks repository conflict state when delete conflicts', async () => {
    const repository = createRepository();
    const { state, set } = createCloudRepoStoreHarness();
    const runtime = createRuntimeMock({
      ensureRepositoryTree: vi.fn(async () => repository),
      ensureCleanRepository: vi.fn(async () => true),
      getRecursiveEntries: vi.fn(async () => [createTreeEntry('docs/a.md', 'file', { sha: 'sha-a' })]),
      runChangeset: vi.fn(async () => createConflictResult(['docs/a.md'])),
    });
    const actions = createCloudRepoRemoteMutationActions(set, runtime);

    const result = await actions.deleteRemoteNode(repository.id, 'docs/a.md', 'file');

    expect(result).toBe(false);
    expect(state.syncStatus.get(repository.id)).toBe('error');
    expect(state.error).toBe(CLOUD_REPO_SYNC_CONFLICT_ERROR);
  });
});
