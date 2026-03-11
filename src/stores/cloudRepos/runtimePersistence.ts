import type { RepositoryInfo } from '@/lib/tauri/githubRepoCommands';
import { createCloudNoteLogicalPath } from './ids';
import { loadCloudRepoState, scheduleCloudRepoStateSave } from './persistence';
import {
  getSyncStatusForRepository,
  type CloudRepoGet,
  type CloudRepoSet,
} from './storeSupport';
import type { CloudRepoSnapshot, PersistedCloudRepoState } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';

type RuntimePersistence = Pick<
  CloudRepoStoreRuntime,
  'persistRepository' | 'getRepository' | 'buildSnapshot' | 'hydrateRepository'
>;

export function createCloudRepoRuntimePersistence(
  set: CloudRepoSet,
  get: CloudRepoGet
): RuntimePersistence {
  const createPersistedState = (repositoryId: number): PersistedCloudRepoState => {
    const state = get();
    return {
      tree: state.repoTrees.get(repositoryId) ?? [],
      files: Array.from(state.fileCache.values()).filter(
        (file) => file.repositoryId === repositoryId
      ),
      drafts: Array.from(state.drafts.values()).filter(
        (draft) => draft.repositoryId === repositoryId
      ),
      lastSyncedAt: null,
    };
  };

  const persistRepository = (repositoryId: number): void => {
    scheduleCloudRepoStateSave(repositoryId, createPersistedState(repositoryId));
  };

  const getRepository = (repoId: number): RepositoryInfo | null =>
    get().repositories.find((item) => item.id === repoId) ?? null;

  const buildSnapshot = (
    repository: RepositoryInfo,
    relativePath: string,
    content: string,
    sha: string | null
  ): CloudRepoSnapshot => ({
    repositoryId: repository.id,
    owner: repository.owner,
    repo: repository.name,
    branch: repository.defaultBranch,
    relativePath,
    logicalPath: createCloudNoteLogicalPath(
      repository.id,
      repository.defaultBranch,
      relativePath
    ),
    content,
    sha,
  });

  const hydrateRepository = async (repositoryId: number): Promise<void> => {
    if (get().hydratedRepos.has(repositoryId)) return;

    const persisted = await loadCloudRepoState(repositoryId);
    if (!persisted) {
      set((state) => {
        const syncStatus = new Map(state.syncStatus);
        if (!syncStatus.has(repositoryId)) {
          syncStatus.set(repositoryId, 'synced');
        }
        return {
          syncStatus,
          hydratedRepos: new Set(state.hydratedRepos).add(repositoryId),
        };
      });
      return;
    }

    set((state) => {
      const repoTrees = new Map(state.repoTrees);
      const fileCache = new Map(state.fileCache);
      const drafts = new Map(state.drafts);
      const syncStatus = new Map(state.syncStatus);

      repoTrees.set(repositoryId, persisted.tree ?? []);

      for (const file of persisted.files ?? []) {
        fileCache.set(file.logicalPath, file);
      }

      for (const draft of persisted.drafts ?? []) {
        drafts.set(draft.logicalPath, draft);
      }

      syncStatus.set(
        repositoryId,
        getSyncStatusForRepository(persisted.drafts ?? [], repositoryId)
      );

      return {
        repoTrees,
        fileCache,
        drafts,
        syncStatus,
        hydratedRepos: new Set(state.hydratedRepos).add(repositoryId),
      };
    });
  };

  return {
    persistRepository,
    getRepository,
    buildSnapshot,
    hydrateRepository,
  };
}
