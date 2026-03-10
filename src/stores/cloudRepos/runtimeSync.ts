import {
  githubRepoCommands,
  type RepoChangeOperation,
  type RepoChangesetCommitResult,
  type RepositoryInfo,
} from '@/lib/tauri/githubRepoCommands';
import { friendlySyncError } from '@/lib/sync/syncErrors';
import { createRepositoryStatus } from './syncState';
import {
  clearSyncTimer,
  registerSyncTimer,
  type CloudRepoGet,
  type CloudRepoSet,
} from './storeSupport';
import type { CloudRepoStoreRuntime } from './storeRuntime';

type RuntimeSync = Pick<
  CloudRepoStoreRuntime,
  'scheduleAutoSync' | 'ensureCleanRepository' | 'runChangeset'
>;

export function createCloudRepoRuntimeSync(
  set: CloudRepoSet,
  get: CloudRepoGet
): RuntimeSync {
  const scheduleAutoSync = (repositoryId: number): void => {
    clearSyncTimer(repositoryId);
    registerSyncTimer(
      repositoryId,
      setTimeout(() => {
        void get().syncRepository(repositoryId);
      }, 4000)
    );
  };

  const ensureCleanRepository = async (repoId: number): Promise<boolean> => {
    if (!get().hasChanges(repoId)) {
      return true;
    }

    const result = await get().syncRepository(repoId);
    if (result?.status === 'conflict') {
      return false;
    }

    return get().syncStatus.get(repoId) !== 'error';
  };

  const runChangeset = async (
    repository: RepositoryInfo,
    operations: RepoChangeOperation[],
    message: string
  ): Promise<RepoChangesetCommitResult | null> => {
    if (operations.length === 0) {
      return {
        status: 'committed',
        commit: null,
        conflicts: [],
        updatedFiles: [],
      };
    }

    set((state) => ({
      syncStatus: createRepositoryStatus(state.syncStatus, repository.id, 'syncing'),
      error: null,
    }));

    try {
      return await githubRepoCommands.commitChangeset(
        repository.owner,
        repository.name,
        repository.defaultBranch,
        message,
        operations
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set((state) => ({
        syncStatus: createRepositoryStatus(state.syncStatus, repository.id, 'error'),
        error: friendlySyncError(errorMessage),
      }));
      return null;
    }
  };

  return {
    scheduleAutoSync,
    ensureCleanRepository,
    runChangeset,
  };
}
