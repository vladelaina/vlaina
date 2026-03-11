import {
  githubRepoCommands,
  type RepositoryInfo,
  type TreeEntry,
} from '@/lib/tauri/githubRepoCommands';
import { friendlySyncError } from '@/lib/sync/syncErrors';
import { createCloudNoteLogicalPath } from './ids';
import { applyDraftNodes, buildTreeFromRecursiveEntries } from './tree';
import type { CloudRepoFileRecord } from './types';
import type { CloudRepoStoreRuntime } from './storeRuntime';
import type { CloudRepoGet, CloudRepoSet } from './storeSupport';

type RuntimeTreeAccessDependencies = Pick<
  CloudRepoStoreRuntime,
  'persistRepository' | 'getRepository' | 'hydrateRepository'
>;

type RuntimeTreeAccess = Pick<
  CloudRepoStoreRuntime,
  'refreshRepositoryTree' | 'ensureRepositoryTree' | 'readFileContent' | 'getRecursiveEntries'
>;

export function createCloudRepoRuntimeTreeAccess(
  set: CloudRepoSet,
  get: CloudRepoGet,
  runtime: RuntimeTreeAccessDependencies
): RuntimeTreeAccess {
  const markRepositoryTreeLoaded = (repositoryId: number): void => {
    set((state) => ({
      loadedRepoTrees: new Set(state.loadedRepoTrees).add(repositoryId),
    }));
  };

  const refreshRepositoryTree = async (repoId: number): Promise<void> => {
    const repository = runtime.getRepository(repoId);
    if (!repository) return;

    try {
      const entries = await githubRepoCommands.getRepoTreeRecursive(
        repository.owner,
        repository.name,
        repository.defaultBranch
      );

      set((state) => {
        const repoTrees = new Map(state.repoTrees);
        const nextTree = applyDraftNodes(
          buildTreeFromRecursiveEntries(entries, repoTrees.get(repoId) ?? []),
          Array.from(state.drafts.values()).filter((draft) => draft.repositoryId === repoId)
        );
        repoTrees.set(repoId, nextTree);
        return { repoTrees, error: null };
      });

      markRepositoryTreeLoaded(repoId);
      runtime.persistRepository(repoId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: friendlySyncError(errorMessage) });
    }
  };

  const ensureRepositoryTree = async (repoId: number): Promise<RepositoryInfo | null> => {
    await runtime.hydrateRepository(repoId);
    const repository = runtime.getRepository(repoId);
    if (!repository) return null;
    if (!get().loadedRepoTrees.has(repoId)) {
      await refreshRepositoryTree(repoId);
    }
    return runtime.getRepository(repoId);
  };

  const readFileContent = async (
    repository: RepositoryInfo,
    relativePath: string
  ): Promise<{ content: string; sha: string | null } | null> => {
    const logicalPath = createCloudNoteLogicalPath(
      repository.id,
      repository.defaultBranch,
      relativePath
    );
    const cached = get().fileCache.get(logicalPath);
    if (cached) {
      return { content: cached.content, sha: cached.sha };
    }

    const file = await githubRepoCommands.getFileContent(
      repository.owner,
      repository.name,
      relativePath
    );
    if (!file) return null;

    const record: CloudRepoFileRecord = {
      logicalPath,
      repositoryId: repository.id,
      owner: repository.owner,
      repo: repository.name,
      branch: repository.defaultBranch,
      relativePath,
      content: file.content,
      sha: file.sha,
      updatedAt: Date.now(),
    };

    set((state) => {
      const fileCache = new Map(state.fileCache);
      fileCache.set(logicalPath, record);
      return { fileCache };
    });

    return { content: file.content, sha: file.sha };
  };

  const getRecursiveEntries = async (
    repository: RepositoryInfo
  ): Promise<TreeEntry[] | null> => {
    try {
      return await githubRepoCommands.getRepoTreeRecursive(
        repository.owner,
        repository.name,
        repository.defaultBranch
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: friendlySyncError(errorMessage) });
      return null;
    }
  };

  return {
    refreshRepositoryTree,
    ensureRepositoryTree,
    readFileContent,
    getRecursiveEntries,
  };
}
