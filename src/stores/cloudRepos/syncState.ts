import type { RepoChangesetCommitResult } from '@/lib/tauri/githubRepoCommands';
import type {
  CloudRepoDraftRecord,
  CloudRepoStore,
  CloudRepoSyncStatus,
} from './types';
import { getSyncStatusForRepository, type CloudRepoSet } from './storeSupport';

export const CLOUD_REPO_SYNC_CONFLICT_ERROR = 'Cloud repository sync conflict detected';

export function createRepositoryStatus(
  syncStatus: Map<number, CloudRepoSyncStatus>,
  repositoryId: number,
  status: CloudRepoSyncStatus
): Map<number, CloudRepoSyncStatus> {
  const nextStatus = new Map(syncStatus);
  nextStatus.set(repositoryId, status);
  return nextStatus;
}

export function createConflictResultFromDrafts(
  drafts: CloudRepoDraftRecord[]
): RepoChangesetCommitResult {
  return {
    status: 'conflict',
    commit: null,
    conflicts: drafts.map((draft) => ({
      path: draft.relativePath,
      reason: 'modified',
    })),
    updatedFiles: [],
  };
}

export function createRepositoryConflictStatus(
  syncStatus: Map<number, CloudRepoSyncStatus>,
  repositoryId: number
): Map<number, CloudRepoSyncStatus> {
  return createRepositoryStatus(syncStatus, repositoryId, 'error');
}

export function createRepositoryStatusFromDrafts(
  syncStatus: Map<number, CloudRepoSyncStatus>,
  repositoryId: number,
  drafts: Iterable<CloudRepoDraftRecord>
): Map<number, CloudRepoSyncStatus> {
  const nextStatus = new Map(syncStatus);
  nextStatus.set(repositoryId, getSyncStatusForRepository(drafts, repositoryId));
  return nextStatus;
}

export function setRepositoryConflictState(
  set: CloudRepoSet,
  repositoryId: number,
  error: string = CLOUD_REPO_SYNC_CONFLICT_ERROR
): void {
  set((state: CloudRepoStore) => ({
    syncStatus: createRepositoryConflictStatus(state.syncStatus, repositoryId),
    error,
  }));
}

export function setRepositoryStatus(
  set: CloudRepoSet,
  repositoryId: number,
  status: CloudRepoSyncStatus
): void {
  set((state: CloudRepoStore) => ({
    syncStatus: createRepositoryStatus(state.syncStatus, repositoryId, status),
  }));
}
