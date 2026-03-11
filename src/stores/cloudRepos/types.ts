import type { RepoChangesetCommitResult, RepositoryInfo } from '@/lib/tauri/githubRepoCommands';

export type CloudRepoSyncStatus = 'synced' | 'syncing' | 'has_changes' | 'error';
export type CloudRepoNodeKind = 'file' | 'folder';

export interface CloudRepoNode {
  path: string;
  name: string;
  kind: CloudRepoNodeKind;
  sha: string | null;
  size?: number;
  expanded?: boolean;
  children?: CloudRepoNode[];
}

export interface CloudRepoFileRecord {
  logicalPath: string;
  repositoryId: number;
  owner: string;
  repo: string;
  branch: string;
  relativePath: string;
  content: string;
  sha: string | null;
  updatedAt: number;
}

export interface CloudRepoDraftRecord {
  logicalPath: string;
  repositoryId: number;
  owner: string;
  repo: string;
  branch: string;
  relativePath: string;
  content: string;
  previousSha: string | null;
  updatedAt: number;
  state: 'dirty' | 'conflict';
}

export interface CloudRepoSnapshot {
  repositoryId: number;
  owner: string;
  repo: string;
  branch: string;
  relativePath: string;
  logicalPath: string;
  content: string;
  sha: string | null;
}

export interface PersistedCloudRepoState {
  tree: CloudRepoNode[];
  files: CloudRepoFileRecord[];
  drafts: CloudRepoDraftRecord[];
  lastSyncedAt: number | null;
}

export interface CloudRepoDraftCounts {
  dirty: number;
  conflict: number;
}

export interface CloudRepoStoreState {
  repositories: RepositoryInfo[];
  isLoadingRepos: boolean;
  expandedRepos: Set<number>;
  repoTrees: Map<number, CloudRepoNode[]>;
  loadedRepoTrees: Set<number>;
  fileCache: Map<string, CloudRepoFileRecord>;
  drafts: Map<string, CloudRepoDraftRecord>;
  syncStatus: Map<number, CloudRepoSyncStatus>;
  error: string | null;
  sectionExpanded: boolean;
  hydratedRepos: Set<number>;
}

export interface CloudRepoStoreActions {
  loadRepositories: () => Promise<void>;
  createRepository: (
    name: string,
    isPrivate: boolean,
    description?: string
  ) => Promise<RepositoryInfo | null>;
  removeRepository: (repoId: number) => void;
  toggleRepoExpanded: (repoId: number) => Promise<void>;
  toggleFolder: (repoId: number, folderPath: string) => Promise<void>;
  openRemoteNote: (
    repoId: number,
    relativePath: string
  ) => Promise<CloudRepoSnapshot | null>;
  createRemoteNote: (
    repoId: number,
    parentPath?: string,
    name?: string
  ) => Promise<CloudRepoSnapshot | null>;
  createRemoteFolder: (repoId: number, parentPath?: string, name?: string) => Promise<string | null>;
  renameRemoteNode: (
    repoId: number,
    path: string,
    kind: CloudRepoNodeKind,
    nextName: string
  ) => Promise<string | null>;
  deleteRemoteNode: (
    repoId: number,
    path: string,
    kind: CloudRepoNodeKind
  ) => Promise<boolean>;
  saveDraft: (snapshot: Omit<CloudRepoSnapshot, 'content'> & { content: string }) => Promise<void>;
  syncRepository: (repoId: number) => Promise<RepoChangesetCommitResult | null>;
  getRepoNodes: (repoId: number) => CloudRepoNode[];
  getDraftCounts: (repoId: number) => CloudRepoDraftCounts;
  getFileState: (
    repoId: number,
    branch: string,
    relativePath: string
  ) => CloudRepoDraftRecord | undefined;
  hasChanges: (repoId: number) => boolean;
  clearError: () => void;
  toggleSectionExpanded: () => void;
}

export type CloudRepoStore = CloudRepoStoreState & CloudRepoStoreActions;
