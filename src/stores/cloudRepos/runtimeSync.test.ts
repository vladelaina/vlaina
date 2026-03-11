import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudRepoRuntimeSync } from './runtimeSync';
import { clearSyncTimer } from './storeSupport';
import {
  createCloudRepoStoreHarness,
  createCommittedResult,
  createConflictResult,
  createRepository,
} from './testUtils';

const { githubRepoCommandsMock } = vi.hoisted(() => ({
  githubRepoCommandsMock: {
    commitChangeset: vi.fn(),
  },
}));

vi.mock('@/lib/tauri/githubRepoCommands', () => ({
  githubRepoCommands: githubRepoCommandsMock,
}));

describe('cloud repo runtime sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearSyncTimer(1);
    vi.useRealTimers();
  });

  it('scheduleAutoSync replaces the previous timer for the same repository', async () => {
    const syncRepository = vi.fn(async () => null);
    const { get, set } = createCloudRepoStoreHarness({ syncRepository });
    const runtime = createCloudRepoRuntimeSync(set, get);

    runtime.scheduleAutoSync(1);
    await vi.advanceTimersByTimeAsync(2000);
    runtime.scheduleAutoSync(1);
    await vi.advanceTimersByTimeAsync(3999);

    expect(syncRepository).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(syncRepository).toHaveBeenCalledTimes(1);
    expect(syncRepository).toHaveBeenCalledWith(1);
  });

  it('ensureCleanRepository returns early when the repository has no changes', async () => {
    const syncRepository = vi.fn(async () => null);
    const { get, set } = createCloudRepoStoreHarness({
      hasChanges: () => false,
      syncRepository,
    });
    const runtime = createCloudRepoRuntimeSync(set, get);

    await expect(runtime.ensureCleanRepository(1)).resolves.toBe(true);
    expect(syncRepository).not.toHaveBeenCalled();
  });

  it('ensureCleanRepository reports false when sync ends in conflict', async () => {
    const { get, set } = createCloudRepoStoreHarness({
      hasChanges: () => true,
      syncRepository: vi.fn(async () => createConflictResult(['docs/a.md'])),
    });
    const runtime = createCloudRepoRuntimeSync(set, get);

    await expect(runtime.ensureCleanRepository(1)).resolves.toBe(false);
  });

  it('runChangeset returns a no-op committed result for empty operations', async () => {
    const { get, set } = createCloudRepoStoreHarness();
    const runtime = createCloudRepoRuntimeSync(set, get);

    await expect(
      runtime.runChangeset(createRepository(), [], 'sync')
    ).resolves.toEqual({
      status: 'committed',
      commit: null,
      conflicts: [],
      updatedFiles: [],
    });
    expect(githubRepoCommandsMock.commitChangeset).not.toHaveBeenCalled();
  });

  it('runChangeset delegates to github commands and marks the repository as syncing', async () => {
    const repository = createRepository();
    const { state, get, set } = createCloudRepoStoreHarness();
    githubRepoCommandsMock.commitChangeset.mockResolvedValue(
      createCommittedResult([{ path: 'docs/a.md', sha: 'sha-new' }])
    );
    const runtime = createCloudRepoRuntimeSync(set, get);

    const result = await runtime.runChangeset(
      repository,
      [{ operationType: 'upsert', path: 'docs/a.md', content: 'A', previousSha: 'sha-old' }],
      'sync'
    );

    expect(result?.status).toBe('committed');
    expect(githubRepoCommandsMock.commitChangeset).toHaveBeenCalledWith(
      repository.owner,
      repository.name,
      repository.defaultBranch,
      'sync',
      [{ operationType: 'upsert', path: 'docs/a.md', content: 'A', previousSha: 'sha-old' }]
    );
    expect(state.syncStatus.get(repository.id)).toBe('syncing');
    expect(state.error).toBeNull();
  });

  it('runChangeset converts command errors into repository error state', async () => {
    const repository = createRepository();
    const { state, get, set } = createCloudRepoStoreHarness();
    githubRepoCommandsMock.commitChangeset.mockRejectedValue(new Error('403 forbidden'));
    const runtime = createCloudRepoRuntimeSync(set, get);

    const result = await runtime.runChangeset(
      repository,
      [{ operationType: 'delete', path: 'docs/a.md', previousSha: 'sha-old' }],
      'delete'
    );

    expect(result).toBeNull();
    expect(state.syncStatus.get(repository.id)).toBe('error');
    expect(state.error).toBe('Permission denied');
  });
});
