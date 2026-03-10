import { createCloudNoteLogicalPath } from './ids';
import {
  CLOUD_REPO_SYNC_CONFLICT_ERROR,
  createConflictResultFromDrafts,
  createRepositoryStatusFromDrafts,
  setRepositoryConflictState,
  setRepositoryStatus,
} from './syncState';
import { upsertTreeNode } from './tree';
import type {
  CloudRepoDraftRecord,
  CloudRepoFileRecord,
  CloudRepoStoreActions,
} from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import {
  buildSyncCommitMessage,
  clearSyncTimer,
  type CloudRepoGet,
  type CloudRepoSet,
} from './storeSupport';

export function createCloudRepoDraftActions(
  set: CloudRepoSet,
  get: CloudRepoGet,
  runtime: CloudRepoStoreRuntime
): Pick<CloudRepoStoreActions, 'saveDraft' | 'syncRepository'> {
  return {
    saveDraft: async (snapshot) => {
      const logicalPath = createCloudNoteLogicalPath(
        snapshot.repositoryId,
        snapshot.branch,
        snapshot.relativePath
      );

      const existingFile = get().fileCache.get(logicalPath);
      const existingDraft = get().drafts.get(logicalPath);
      const draft: CloudRepoDraftRecord = {
        logicalPath,
        repositoryId: snapshot.repositoryId,
        owner: snapshot.owner,
        repo: snapshot.repo,
        branch: snapshot.branch,
        relativePath: snapshot.relativePath,
        content: snapshot.content,
        previousSha: existingDraft?.previousSha ?? existingFile?.sha ?? snapshot.sha ?? null,
        updatedAt: Date.now(),
        state: existingDraft?.state === 'conflict' ? 'conflict' : 'dirty',
      };

      const fileRecord: CloudRepoFileRecord = {
        logicalPath,
        repositoryId: snapshot.repositoryId,
        owner: snapshot.owner,
        repo: snapshot.repo,
        branch: snapshot.branch,
        relativePath: snapshot.relativePath,
        content: snapshot.content,
        sha: existingFile?.sha ?? snapshot.sha ?? null,
        updatedAt: Date.now(),
      };

      set((state) => {
        const drafts = new Map(state.drafts);
        const fileCache = new Map(state.fileCache);
        const syncStatus = new Map(state.syncStatus);
        const repoTrees = new Map(state.repoTrees);

        drafts.set(logicalPath, draft);
        fileCache.set(logicalPath, fileRecord);
        syncStatus.set(snapshot.repositoryId, 'has_changes');
        repoTrees.set(
          snapshot.repositoryId,
          upsertTreeNode(
            repoTrees.get(snapshot.repositoryId) ?? [],
            snapshot.relativePath,
            'file',
            snapshot.sha
          )
        );

        return { drafts, fileCache, syncStatus, repoTrees };
      });

      runtime.persistRepository(snapshot.repositoryId);
      runtime.scheduleAutoSync(snapshot.repositoryId);
    },

    syncRepository: async (repoId) => {
      clearSyncTimer(repoId);
      const repository = runtime.getRepository(repoId);
      if (!repository) return null;

      const conflictDrafts = Array.from(get().drafts.values()).filter(
        (draft) => draft.repositoryId === repoId && draft.state === 'conflict'
      );
      const drafts = Array.from(get().drafts.values()).filter(
        (draft) => draft.repositoryId === repoId && draft.state !== 'conflict'
      );

      if (drafts.length === 0) {
        if (conflictDrafts.length > 0) {
          setRepositoryConflictState(set, repoId);
          runtime.persistRepository(repoId);
          return createConflictResultFromDrafts(conflictDrafts);
        }

        setRepositoryStatus(set, repoId, 'synced');
        return null;
      }

      const result = await runtime.runChangeset(
        repository,
        drafts.map((draft) => ({
          operationType: 'upsert',
          path: draft.relativePath,
          content: draft.content,
          previousSha: draft.previousSha,
        })),
        buildSyncCommitMessage()
      );

      if (!result) {
        runtime.persistRepository(repoId);
        return null;
      }

      if (result.status === 'conflict') {
        const conflictedPaths = new Set<string>(result.conflicts.map((conflict) => conflict.path));
        set((state) => {
          const nextDrafts = new Map(state.drafts);
          for (const draft of drafts) {
            if (conflictedPaths.has(draft.relativePath)) {
              nextDrafts.set(draft.logicalPath, { ...draft, state: 'conflict' });
            }
          }
          return {
            drafts: nextDrafts,
            syncStatus: createRepositoryStatusFromDrafts(state.syncStatus, repoId, nextDrafts.values()),
            error: CLOUD_REPO_SYNC_CONFLICT_ERROR,
          };
        });
        runtime.persistRepository(repoId);
        return result;
      }

      const updatedShaByPath = new Map<string, string>(
        result.updatedFiles.map((file) => [file.path, file.sha])
      );

      set((state) => {
        const draftsMap = new Map(state.drafts);
        const fileCache = new Map(state.fileCache);

        for (const draft of drafts) {
          draftsMap.delete(draft.logicalPath);
          const cached = fileCache.get(draft.logicalPath);
          if (cached) {
            fileCache.set(draft.logicalPath, {
              ...cached,
              content: draft.content,
              sha: updatedShaByPath.get(draft.relativePath) ?? cached.sha,
              updatedAt: Date.now(),
            });
          }
        }

        return {
          drafts: draftsMap,
          fileCache,
          syncStatus: createRepositoryStatusFromDrafts(state.syncStatus, repoId, draftsMap.values()),
          error: null,
        };
      });

      await runtime.refreshRepositoryTree(repoId);
      runtime.persistRepository(repoId);
      return result;
    },
  };
}
