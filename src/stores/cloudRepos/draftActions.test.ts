import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudNoteLogicalPath } from './ids';
import { createCloudRepoDraftActions } from './draftActions';
import { CLOUD_REPO_SYNC_CONFLICT_ERROR } from './syncState';
import {
  createCloudRepoStoreHarness,
  createCommittedResult,
  createConflictResult,
  createDraftRecord,
  createFileRecord,
  createRepository,
  createRuntimeMock,
} from './testUtils';

describe('cloud repo draft actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:34:56Z'));
  });

  it('saveDraft stores file cache, draft, tree node, and schedules sync', async () => {
    const repository = createRepository();
    const existingFile = createFileRecord(repository.id, 'docs/note.md', { sha: 'base-sha' });
    const { state, get, set } = createCloudRepoStoreHarness({
      fileCache: new Map([[existingFile.logicalPath, existingFile]]),
    });
    const runtime = createRuntimeMock();
    const actions = createCloudRepoDraftActions(set, get, runtime);

    await actions.saveDraft({
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
      branch: repository.defaultBranch,
      relativePath: 'docs/note.md',
      logicalPath: createCloudNoteLogicalPath(repository.id, repository.defaultBranch, 'docs/note.md'),
      content: '# updated',
      sha: null,
    });

    const logicalPath = createCloudNoteLogicalPath(repository.id, repository.defaultBranch, 'docs/note.md');
    expect(state.drafts.get(logicalPath)).toMatchObject({
      relativePath: 'docs/note.md',
      content: '# updated',
      previousSha: 'base-sha',
      state: 'dirty',
    });
    expect(state.fileCache.get(logicalPath)).toMatchObject({
      content: '# updated',
      sha: 'base-sha',
    });
    expect(state.syncStatus.get(repository.id)).toBe('has_changes');
    expect(state.repoTrees.get(repository.id)?.[0]).toMatchObject({
      path: 'docs',
      kind: 'folder',
    });
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
    expect(runtime.scheduleAutoSync).toHaveBeenCalledWith(repository.id);
  });

  it('saveDraft preserves conflict drafts and previous sha', async () => {
    const repository = createRepository();
    const conflictDraft = createDraftRecord(repository.id, 'docs/note.md', 'conflict', {
      previousSha: 'stale-sha',
    });
    const { state, get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[conflictDraft.logicalPath, conflictDraft]]),
    });
    const runtime = createRuntimeMock();
    const actions = createCloudRepoDraftActions(set, get, runtime);

    await actions.saveDraft({
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
      branch: repository.defaultBranch,
      relativePath: 'docs/note.md',
      logicalPath: conflictDraft.logicalPath,
      content: '# edited again',
      sha: 'ignored',
    });

    expect(state.drafts.get(conflictDraft.logicalPath)).toMatchObject({
      content: '# edited again',
      previousSha: 'stale-sha',
      state: 'conflict',
    });
  });

  it('syncRepository reports conflict drafts even when there are no dirty drafts', async () => {
    const repository = createRepository();
    const conflictDraft = createDraftRecord(repository.id, 'docs/note.md', 'conflict');
    const { state, get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[conflictDraft.logicalPath, conflictDraft]]),
    });
    const runtime = createRuntimeMock({
      getRepository: vi.fn(() => repository),
    });
    const actions = createCloudRepoDraftActions(set, get, runtime);

    const result = await actions.syncRepository(repository.id);

    expect(result).toEqual(createConflictResult(['docs/note.md']));
    expect(state.syncStatus.get(repository.id)).toBe('error');
    expect(state.error).toBe(CLOUD_REPO_SYNC_CONFLICT_ERROR);
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
    expect(runtime.runChangeset).not.toHaveBeenCalled();
  });

  it('syncRepository marks only conflicted drafts when remote conflict occurs', async () => {
    const repository = createRepository();
    const firstDraft = createDraftRecord(repository.id, 'docs/a.md', 'dirty', {
      content: 'A',
      previousSha: 'sha-a',
    });
    const secondDraft = createDraftRecord(repository.id, 'docs/b.md', 'dirty', {
      content: 'B',
      previousSha: 'sha-b',
    });
    const { state, get, set } = createCloudRepoStoreHarness({
      drafts: new Map([
        [firstDraft.logicalPath, firstDraft],
        [secondDraft.logicalPath, secondDraft],
      ]),
    });
    const runtime = createRuntimeMock({
      getRepository: vi.fn(() => repository),
      runChangeset: vi.fn(async () => createConflictResult(['docs/b.md'])),
    });
    const actions = createCloudRepoDraftActions(set, get, runtime);

    const result = await actions.syncRepository(repository.id);

    expect(result).toEqual(createConflictResult(['docs/b.md']));
    expect(state.drafts.get(firstDraft.logicalPath)?.state).toBe('dirty');
    expect(state.drafts.get(secondDraft.logicalPath)?.state).toBe('conflict');
    expect(state.syncStatus.get(repository.id)).toBe('error');
    expect(state.error).toBe(CLOUD_REPO_SYNC_CONFLICT_ERROR);
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
  });

  it('syncRepository clears dirty drafts and refreshes repository state after commit', async () => {
    const repository = createRepository();
    const draft = createDraftRecord(repository.id, 'docs/a.md', 'dirty', {
      content: '# body',
      previousSha: 'sha-old',
    });
    const cachedFile = createFileRecord(repository.id, 'docs/a.md', {
      content: '# old',
      sha: 'sha-old',
    });
    const { state, get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[draft.logicalPath, draft]]),
      fileCache: new Map([[cachedFile.logicalPath, cachedFile]]),
    });
    const runtime = createRuntimeMock({
      getRepository: vi.fn(() => repository),
      runChangeset: vi.fn(async () =>
        createCommittedResult([{ path: 'docs/a.md', sha: 'sha-new' }])
      ),
    });
    const actions = createCloudRepoDraftActions(set, get, runtime);

    const result = await actions.syncRepository(repository.id);

    expect(result?.status).toBe('committed');
    expect(state.drafts.size).toBe(0);
    expect(state.fileCache.get(draft.logicalPath)).toMatchObject({
      content: '# body',
      sha: 'sha-new',
    });
    expect(state.syncStatus.get(repository.id)).toBe('synced');
    expect(state.error).toBeNull();
    expect(runtime.refreshRepositoryTree).toHaveBeenCalledWith(repository.id);
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
  });

  it('syncRepository persists state when changeset execution fails', async () => {
    const repository = createRepository();
    const draft = createDraftRecord(repository.id, 'docs/a.md', 'dirty');
    const { get, set } = createCloudRepoStoreHarness({
      drafts: new Map([[draft.logicalPath, draft]]),
    });
    const runtime = createRuntimeMock({
      getRepository: vi.fn(() => repository),
      runChangeset: vi.fn(async () => null),
    });
    const actions = createCloudRepoDraftActions(set, get, runtime);

    const result = await actions.syncRepository(repository.id);

    expect(result).toBeNull();
    expect(runtime.persistRepository).toHaveBeenCalledWith(repository.id);
    expect(runtime.refreshRepositoryTree).not.toHaveBeenCalled();
  });
});
