import type { RepoChangeOperation } from '@/lib/tauri/githubRepoCommands';
import { createCloudNoteLogicalPath } from './ids';
import {
  createRenamedPath,
  normalizeCloudRelativePath,
  remapCloudPathPrefix,
} from './pathOperations';
import type { CloudRepoFileRecord, CloudRepoStoreActions } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import {
  createCommitMessage,
  isPathWithinFolder,
  type CloudRepoSet,
} from './storeSupport';
import {
  createRepositoryStatusFromDrafts,
  setRepositoryConflictState,
} from './syncState';

export function createCloudRepoRemoteMutationActions(
  set: CloudRepoSet,
  runtime: CloudRepoStoreRuntime
): Pick<CloudRepoStoreActions, 'renameRemoteNode' | 'deleteRemoteNode'> {
  return {
    renameRemoteNode: async (repoId, path, kind, nextName) => {
      const repository = await runtime.ensureRepositoryTree(repoId);
      if (!repository) return null;
      if (!(await runtime.ensureCleanRepository(repoId))) return null;

      const normalizedPath = normalizeCloudRelativePath(path);
      const nextPath = createRenamedPath(normalizedPath, kind, nextName);
      if (nextPath === normalizedPath) return nextPath;

      const recursiveEntries = await runtime.getRecursiveEntries(repository);
      if (!recursiveEntries) return null;

      const existingPaths = new Set(
        recursiveEntries
          .map((entry) => normalizeCloudRelativePath(entry.path))
          .filter((entryPath) => {
            if (kind === 'file') return entryPath !== normalizedPath;
            return !isPathWithinFolder(entryPath, normalizedPath);
          })
      );

      if (existingPaths.has(nextPath)) {
        set({ error: 'A cloud note or folder with that name already exists' });
        return null;
      }

      const sourceEntries = recursiveEntries.filter((entry) => {
        if (entry.entryType !== 'file') return false;
        return kind === 'file'
          ? entry.path === normalizedPath
          : isPathWithinFolder(entry.path, normalizedPath);
      });

      const operations: RepoChangeOperation[] = [];
      for (const entry of sourceEntries) {
        const remoteFile = await runtime.readFileContent(repository, entry.path);
        if (!remoteFile) {
          set({ error: 'Failed to read cloud repository file before rename' });
          return null;
        }

        const destinationPath =
          kind === 'file'
            ? nextPath
            : remapCloudPathPrefix(entry.path, normalizedPath, nextPath);

        operations.push({
          operationType: 'upsert',
          path: destinationPath,
          content: remoteFile.content,
          previousSha: null,
        });
        operations.push({
          operationType: 'delete',
          path: entry.path,
          previousSha: entry.sha,
        });
      }

      const result = await runtime.runChangeset(
        repository,
        operations,
        createCommitMessage('rename', `${normalizedPath} -> ${nextPath}`)
      );

      if (!result || result.status === 'conflict') {
        if (result?.status === 'conflict') {
          setRepositoryConflictState(set, repoId);
        }
        return null;
      }

      const updatedShaByPath = new Map(result.updatedFiles.map((file) => [file.path, file.sha]));
      set((state) => {
        const fileCache = new Map(state.fileCache);
        const nextEntries: Array<[string, CloudRepoFileRecord]> = [];

        for (const [logicalPath, record] of fileCache.entries()) {
          if (record.repositoryId !== repoId) continue;
          const isAffected =
            kind === 'file'
              ? record.relativePath === normalizedPath
              : isPathWithinFolder(record.relativePath, normalizedPath);

          if (!isAffected) continue;

          fileCache.delete(logicalPath);
          const remappedRelativePath =
            kind === 'file'
              ? nextPath
              : remapCloudPathPrefix(record.relativePath, normalizedPath, nextPath);
          const remappedLogicalPath = createCloudNoteLogicalPath(
            repoId,
            repository.defaultBranch,
            remappedRelativePath
          );

          nextEntries.push([
            remappedLogicalPath,
            {
              ...record,
              logicalPath: remappedLogicalPath,
              relativePath: remappedRelativePath,
              sha: updatedShaByPath.get(remappedRelativePath) ?? record.sha,
              updatedAt: Date.now(),
            },
          ]);
        }

        for (const [logicalPath, record] of nextEntries) {
          fileCache.set(logicalPath, record);
        }

        return {
          fileCache,
          syncStatus: createRepositoryStatusFromDrafts(state.syncStatus, repoId, state.drafts.values()),
          error: null,
        };
      });

      await runtime.refreshRepositoryTree(repoId);
      return nextPath;
    },

    deleteRemoteNode: async (repoId, path, kind) => {
      const repository = await runtime.ensureRepositoryTree(repoId);
      if (!repository) return false;
      if (!(await runtime.ensureCleanRepository(repoId))) return false;

      const normalizedPath = normalizeCloudRelativePath(path);
      const recursiveEntries = await runtime.getRecursiveEntries(repository);
      if (!recursiveEntries) return false;

      const entriesToDelete = recursiveEntries.filter((entry) => {
        if (entry.entryType !== 'file') return false;
        return kind === 'file'
          ? entry.path === normalizedPath
          : isPathWithinFolder(entry.path, normalizedPath);
      });

      const operations: RepoChangeOperation[] = entriesToDelete.map((entry) => ({
        operationType: 'delete',
        path: entry.path,
        previousSha: entry.sha,
      }));

      const result = await runtime.runChangeset(
        repository,
        operations,
        createCommitMessage('delete', normalizedPath)
      );

      if (!result || result.status === 'conflict') {
        if (result?.status === 'conflict') {
          setRepositoryConflictState(set, repoId);
        }
        return false;
      }

      set((state) => {
        const fileCache = new Map(
          Array.from(state.fileCache.entries()).filter(([, file]) => {
            if (file.repositoryId !== repoId) return true;
            if (kind === 'file') return file.relativePath !== normalizedPath;
            return !isPathWithinFolder(file.relativePath, normalizedPath);
          })
        );

        const drafts = new Map(
          Array.from(state.drafts.entries()).filter(([, draft]) => {
            if (draft.repositoryId !== repoId) return true;
            if (kind === 'file') return draft.relativePath !== normalizedPath;
            return !isPathWithinFolder(draft.relativePath, normalizedPath);
          })
        );

        return {
          fileCache,
          drafts,
          syncStatus: createRepositoryStatusFromDrafts(state.syncStatus, repoId, drafts.values()),
          error: null,
        };
      });

      await runtime.refreshRepositoryTree(repoId);
      runtime.persistRepository(repoId);
      return true;
    },
  };
}
