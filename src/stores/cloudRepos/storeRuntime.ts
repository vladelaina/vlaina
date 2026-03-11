import type {
  RepoChangeOperation,
  RepoChangesetCommitResult,
  RepositoryInfo,
  TreeEntry,
} from '@/lib/tauri/githubRepoCommands';
import type { CloudRepoSnapshot } from './types';
import type { CloudRepoGet, CloudRepoSet } from './storeSupport';
import { createCloudRepoRuntimePersistence } from './runtimePersistence';
import { createCloudRepoRuntimeSync } from './runtimeSync';
import { createCloudRepoRuntimeTreeAccess } from './runtimeTreeAccess';

export interface CloudRepoStoreRuntime {
  persistRepository: (repositoryId: number) => void;
  getRepository: (repoId: number) => RepositoryInfo | null;
  buildSnapshot: (
    repository: RepositoryInfo,
    relativePath: string,
    content: string,
    sha: string | null
  ) => CloudRepoSnapshot;
  hydrateRepository: (repositoryId: number) => Promise<void>;
  scheduleAutoSync: (repositoryId: number) => void;
  refreshRepositoryTree: (repoId: number) => Promise<void>;
  ensureRepositoryTree: (repoId: number) => Promise<RepositoryInfo | null>;
  readFileContent: (
    repository: RepositoryInfo,
    relativePath: string
  ) => Promise<{ content: string; sha: string | null } | null>;
  ensureCleanRepository: (repoId: number) => Promise<boolean>;
  runChangeset: (
    repository: RepositoryInfo,
    operations: RepoChangeOperation[],
    message: string
  ) => Promise<RepoChangesetCommitResult | null>;
  getRecursiveEntries: (repository: RepositoryInfo) => Promise<TreeEntry[] | null>;
}

export function createCloudRepoStoreRuntime(
  set: CloudRepoSet,
  get: CloudRepoGet
): CloudRepoStoreRuntime {
  const persistence = createCloudRepoRuntimePersistence(set, get);
  const sync = createCloudRepoRuntimeSync(set, get);
  const treeAccess = createCloudRepoRuntimeTreeAccess(set, get, persistence);

  return {
    ...persistence,
    ...sync,
    ...treeAccess,
  };
}
