import { createCloudNoteLogicalPath } from './ids';
import {
  createFolderKeepFilePath,
  createUniqueFolderPath,
  createUniqueNotePath,
  normalizeCloudRelativePath,
} from './pathOperations';
import type { CloudRepoStoreActions } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import {
  collectTreePaths,
  createCommitMessage,
  type CloudRepoGet,
  type CloudRepoSet,
} from './storeSupport';
import {
  createRepositoryStatusFromDrafts,
  setRepositoryConflictState,
} from './syncState';

export function createCloudRepoRemoteNoteActions(
  set: CloudRepoSet,
  get: CloudRepoGet,
  runtime: CloudRepoStoreRuntime
): Pick<
  CloudRepoStoreActions,
  'openRemoteNote' | 'createRemoteNote' | 'createRemoteFolder'
> {
  return {
    openRemoteNote: async (repoId, relativePath) => {
      const repository = await runtime.ensureRepositoryTree(repoId);
      if (!repository) return null;

      const logicalPath = createCloudNoteLogicalPath(
        repository.id,
        repository.defaultBranch,
        relativePath
      );

      const draft = get().drafts.get(logicalPath);
      if (draft) {
        return runtime.buildSnapshot(repository, relativePath, draft.content, draft.previousSha);
      }

      const cached = get().fileCache.get(logicalPath);
      if (cached) {
        return runtime.buildSnapshot(repository, cached.relativePath, cached.content, cached.sha);
      }

      const file = await runtime.readFileContent(repository, relativePath);
      if (!file) return null;

      runtime.persistRepository(repoId);
      return runtime.buildSnapshot(repository, relativePath, file.content, file.sha);
    },

    createRemoteNote: async (repoId, parentPath = '', name) => {
      const repository = await runtime.ensureRepositoryTree(repoId);
      if (!repository) return null;

      const existingPaths = collectTreePaths(get().repoTrees.get(repoId) ?? []);
      for (const draft of get().drafts.values()) {
        if (draft.repositoryId === repoId) {
          existingPaths.add(draft.relativePath);
        }
      }

      const relativePath = createUniqueNotePath(existingPaths, parentPath, name);
      const snapshot = runtime.buildSnapshot(repository, relativePath, '', null);
      await get().saveDraft(snapshot);
      return snapshot;
    },

    createRemoteFolder: async (repoId, parentPath = '', name) => {
      const repository = await runtime.ensureRepositoryTree(repoId);
      if (!repository) return null;
      if (!(await runtime.ensureCleanRepository(repoId))) return null;

      const recursiveEntries = await runtime.getRecursiveEntries(repository);
      if (!recursiveEntries) return null;

      const existingPaths = new Set<string>();
      for (const entry of recursiveEntries) {
        existingPaths.add(normalizeCloudRelativePath(entry.path));
      }
      const treePaths = collectTreePaths(get().repoTrees.get(repoId) ?? []);
      for (const path of treePaths) {
        existingPaths.add(path);
      }

      const folderPath = createUniqueFolderPath(existingPaths, parentPath, name);
      const placeholderPath = createFolderKeepFilePath(folderPath);

      const result = await runtime.runChangeset(
        repository,
        [
          {
            operationType: 'upsert',
            path: placeholderPath,
            content: '',
            previousSha: null,
          },
        ],
        createCommitMessage('create folder', folderPath)
      );

      if (!result || result.status === 'conflict') {
        if (result?.status === 'conflict') {
          setRepositoryConflictState(set, repoId);
        }
        return null;
      }

      set((state) => ({
        syncStatus: createRepositoryStatusFromDrafts(state.syncStatus, repoId, state.drafts.values()),
      }));
      await runtime.refreshRepositoryTree(repoId);
      return folderPath;
    },
  };
}
