import { githubRepoCommands } from '@/lib/tauri/githubRepoCommands';
import { friendlySyncError } from '@/lib/sync/syncErrors';
import { createCloudNoteLogicalPath } from './ids';
import { createRepositoryStatus } from './syncState';
import { findNode, toggleNodeExpanded } from './tree';
import type { CloudRepoStoreActions } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import {
  clearSyncTimer,
  getDraftCountsForRepository,
  type CloudRepoGet,
  type CloudRepoSet,
} from './storeSupport';

export function createCloudRepoRepositoryActions(
  set: CloudRepoSet,
  get: CloudRepoGet,
  runtime: CloudRepoStoreRuntime
): Pick<
  CloudRepoStoreActions,
  | 'loadRepositories'
  | 'createRepository'
  | 'removeRepository'
  | 'toggleRepoExpanded'
  | 'toggleFolder'
  | 'getRepoNodes'
  | 'getDraftCounts'
  | 'getFileState'
  | 'hasChanges'
  | 'clearError'
  | 'toggleSectionExpanded'
> {
  return {
    loadRepositories: async () => {
      set({ isLoadingRepos: true, error: null });
      try {
        const repositories = await githubRepoCommands.listRepos();
        set({ repositories, isLoadingRepos: false });
        await Promise.all(
          repositories.map((repository) => runtime.hydrateRepository(repository.id))
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({
          repositories: [],
          isLoadingRepos: false,
          error: friendlySyncError(errorMessage),
        });
      }
    },

    createRepository: async (name, isPrivate, description) => {
      try {
        const repository = await githubRepoCommands.createRepo(name, isPrivate, description);
        if (!repository) return null;
        set((state) => ({
          repositories: [repository, ...state.repositories],
          syncStatus: createRepositoryStatus(state.syncStatus, repository.id, 'synced'),
        }));
        return repository;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: friendlySyncError(errorMessage) });
        return null;
      }
    },

    removeRepository: (repoId) => {
      clearSyncTimer(repoId);
      set((state) => {
        const repositories = state.repositories.filter((repository) => repository.id !== repoId);
        const expandedRepos = new Set(state.expandedRepos);
        expandedRepos.delete(repoId);

        const repoTrees = new Map(state.repoTrees);
        repoTrees.delete(repoId);

        const loadedRepoTrees = new Set(state.loadedRepoTrees);
        loadedRepoTrees.delete(repoId);

        const syncStatus = new Map(state.syncStatus);
        syncStatus.delete(repoId);

        const hydratedRepos = new Set(state.hydratedRepos);
        hydratedRepos.delete(repoId);

        const fileCache = new Map(
          Array.from(state.fileCache.entries()).filter(([, file]) => file.repositoryId !== repoId)
        );
        const drafts = new Map(
          Array.from(state.drafts.entries()).filter(([, draft]) => draft.repositoryId !== repoId)
        );

        return {
          repositories,
          expandedRepos,
          repoTrees,
          loadedRepoTrees,
          syncStatus,
          fileCache,
          drafts,
          hydratedRepos,
        };
      });
    },

    toggleRepoExpanded: async (repoId) => {
      await runtime.hydrateRepository(repoId);
      const expandedRepos = new Set(get().expandedRepos);

      if (expandedRepos.has(repoId)) {
        expandedRepos.delete(repoId);
        set({ expandedRepos });
        return;
      }

      expandedRepos.add(repoId);
      set({ expandedRepos });
      await runtime.ensureRepositoryTree(repoId);
    },

    toggleFolder: async (repoId, folderPath) => {
      await runtime.hydrateRepository(repoId);
      const currentTree = get().repoTrees.get(repoId) ?? [];
      const targetNode = findNode(currentTree, folderPath);
      if (!targetNode || targetNode.kind !== 'folder') return;

      set((state) => {
        const repoTrees = new Map(state.repoTrees);
        repoTrees.set(repoId, toggleNodeExpanded(repoTrees.get(repoId) ?? [], folderPath));
        return { repoTrees };
      });
      runtime.persistRepository(repoId);
    },

    getRepoNodes: (repoId) => get().repoTrees.get(repoId) ?? [],

    getDraftCounts: (repoId) => getDraftCountsForRepository(get().drafts.values(), repoId),

    getFileState: (repoId, branch, relativePath) => {
      const logicalPath = createCloudNoteLogicalPath(repoId, branch, relativePath);
      return get().drafts.get(logicalPath);
    },

    hasChanges: (repoId) => {
      const counts = getDraftCountsForRepository(get().drafts.values(), repoId);
      return counts.dirty > 0 || counts.conflict > 0;
    },

    clearError: () => set({ error: null }),

    toggleSectionExpanded: () => {
      set((state) => ({ sectionExpanded: !state.sectionExpanded }));
    },
  };
}
