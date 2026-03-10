import { describe, expect, it } from 'vitest';
import {
  CLOUD_REPO_SYNC_CONFLICT_ERROR,
  createConflictResultFromDrafts,
  createRepositoryConflictStatus,
  createRepositoryStatus,
  createRepositoryStatusFromDrafts,
  setRepositoryConflictState,
  setRepositoryStatus,
} from './syncState';
import { createCloudRepoStoreHarness, createDraftRecord } from './testUtils';

describe('cloud repo sync state helpers', () => {
  it('createRepositoryStatus returns a new status map with the updated value', () => {
    const current = new Map([[1, 'synced' as const]]);
    const result = createRepositoryStatus(current, 2, 'syncing');

    expect(result).not.toBe(current);
    expect(result.get(1)).toBe('synced');
    expect(result.get(2)).toBe('syncing');
  });

  it('createConflictResultFromDrafts maps every draft to a modified conflict', () => {
    const drafts = [
      createDraftRecord(1, 'docs/a.md'),
      createDraftRecord(1, 'docs/b.md'),
    ];

    expect(createConflictResultFromDrafts(drafts)).toEqual({
      status: 'conflict',
      commit: null,
      conflicts: [
        { path: 'docs/a.md', reason: 'modified' },
        { path: 'docs/b.md', reason: 'modified' },
      ],
      updatedFiles: [],
    });
  });

  it('createRepositoryStatusFromDrafts derives error state from conflict drafts', () => {
    const result = createRepositoryStatusFromDrafts(
      new Map(),
      1,
      [createDraftRecord(1, 'docs/a.md', 'conflict')]
    );

    expect(result.get(1)).toBe('error');
    expect(createRepositoryConflictStatus(new Map(), 2).get(2)).toBe('error');
  });

  it('setRepositoryConflictState writes the conflict status and default error', () => {
    const { state, set } = createCloudRepoStoreHarness();

    setRepositoryConflictState(set, 1);

    expect(state.syncStatus.get(1)).toBe('error');
    expect(state.error).toBe(CLOUD_REPO_SYNC_CONFLICT_ERROR);
  });

  it('setRepositoryStatus updates only the repository sync status', () => {
    const { state, set } = createCloudRepoStoreHarness({ error: 'keep me' });

    setRepositoryStatus(set, 1, 'synced');

    expect(state.syncStatus.get(1)).toBe('synced');
    expect(state.error).toBe('keep me');
  });
});
