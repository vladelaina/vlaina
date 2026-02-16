import { create } from 'zustand';
import {
  githubRepoCommands,
  gitCommands,
  hasBackendCommands,
  type RepositoryInfo,
  type FileStatus,
  type CommitInfo,
} from '@/lib/tauri/invoke';
import { useGithubSyncStore } from './useGithubSyncStore';
import { friendlySyncError } from '@/lib/sync/syncErrors';

export type SyncStatus = 'synced' | 'syncing' | 'has_changes' | 'error' | 'not_cloned';

export type { FileStatus, CommitInfo };

interface GithubReposState {
  repositories: RepositoryInfo[];
  isLoadingRepos: boolean;
  expandedRepos: Set<number>;
  localPaths: Map<number, string>;
  clonedRepos: Set<number>;
  syncStatus: Map<number, SyncStatus>;
  gitStatus: Map<number, FileStatus[]>;
  error: string | null;
  sectionExpanded: boolean;
  cloningRepos: Set<number>;
}

interface GithubReposActions {
  loadRepositories: () => Promise<void>;
  createRepository: (name: string, isPrivate: boolean, description?: string) => Promise<RepositoryInfo | null>;
  removeRepository: (repoId: number) => void;
  cloneRepository: (repoId: number) => Promise<boolean>;
  isCloned: (repoId: number) => boolean;
  getLocalPath: (repoId: number) => string | null;
  toggleRepoExpanded: (repoId: number) => void;
  syncRepository: (repoId: number) => Promise<void>;
  pullChanges: (repoId: number) => Promise<void>;
  pushChanges: (repoId: number) => Promise<void>;
  commitChanges: (repoId: number, message: string) => Promise<void>;
  refreshGitStatus: (repoId: number) => Promise<void>;
  getGitStatus: (repoId: number) => FileStatus[];
  hasChanges: (repoId: number) => boolean;
  setSyncStatus: (repoId: number, status: SyncStatus) => void;
  clearError: () => void;
  toggleSectionExpanded: () => void;
}

type GithubReposStore = GithubReposState & GithubReposActions;

const initialState: GithubReposState = {
  repositories: [],
  isLoadingRepos: false,
  expandedRepos: new Set(),
  localPaths: new Map(),
  clonedRepos: new Set(),
  syncStatus: new Map(),
  gitStatus: new Map(),
  error: null,
  sectionExpanded: false,
  cloningRepos: new Set(),
};

function syncCommitMessage(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `sync: ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export const useGithubReposStore = create<GithubReposStore>((set, get) => ({
  ...initialState,

  loadRepositories: async () => {
    const { isConnected } = useGithubSyncStore.getState();
    if (!isConnected || !hasBackendCommands()) {
      set({ repositories: [], isLoadingRepos: false });
      return;
    }

    set({ isLoadingRepos: true, error: null });
    
    try {
      const allRepos = await githubRepoCommands.listRepos();
      const repos = allRepos.filter(r => r.name !== 'nekotick-config');
      
      const clonedRepos = new Set<number>();
      const localPaths = new Map<number, string>();
      const syncStatus = new Map<number, SyncStatus>();
      const reposToClone: RepositoryInfo[] = [];
      
      for (const repo of repos) {
        const isCloned = await gitCommands.isRepoCloned(repo.owner, repo.name);
        if (isCloned) {
          clonedRepos.add(repo.id);
          const path = await gitCommands.getRepoLocalPath(repo.owner, repo.name);
          if (path) {
            localPaths.set(repo.id, path);
          }
          syncStatus.set(repo.id, 'synced');
        } else {
          syncStatus.set(repo.id, 'not_cloned');
          reposToClone.push(repo);
        }
      }
      
      set({ 
        repositories: repos, 
        isLoadingRepos: false,
        clonedRepos,
        localPaths,
        syncStatus,
      });
      
      if (reposToClone.length > 0) {
        (async () => {
          for (const repo of reposToClone) {
            try {
              await get().cloneRepository(repo.id);
            } catch (e) {
              console.error(`Failed to auto-clone ${repo.name}:`, e);
            }
          }
        })();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ 
        error: friendlySyncError(errorMsg), 
        isLoadingRepos: false,
        repositories: [],
      });
    }
  },

  createRepository: async (name, isPrivate, description) => {
    if (!hasBackendCommands()) {
      set({ error: 'Repository creation requires desktop app' });
      return null;
    }

    try {
      const repo = await githubRepoCommands.createRepo(name, isPrivate, description);
      if (repo) {
        set(state => ({
          repositories: [repo, ...state.repositories],
          syncStatus: new Map(state.syncStatus).set(repo.id, 'not_cloned'),
        }));
      }
      return repo;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ error: friendlySyncError(errorMsg) });
      return null;
    }
  },

  removeRepository: (repoId) => {
    set(state => {
      const repositories = state.repositories.filter(r => r.id !== repoId);
      const expandedRepos = new Set(state.expandedRepos);
      expandedRepos.delete(repoId);
      
      const clonedRepos = new Set(state.clonedRepos);
      clonedRepos.delete(repoId);
      
      const localPaths = new Map(state.localPaths);
      localPaths.delete(repoId);
      
      const syncStatus = new Map(state.syncStatus);
      syncStatus.delete(repoId);
      
      const gitStatus = new Map(state.gitStatus);
      gitStatus.delete(repoId);
      
      return { repositories, expandedRepos, clonedRepos, localPaths, syncStatus, gitStatus };
    });
  },

  cloneRepository: async (repoId) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo) return false;
    
    set(state => ({
      cloningRepos: new Set(state.cloningRepos).add(repoId),
      syncStatus: new Map(state.syncStatus).set(repoId, 'syncing'),
    }));
    
    try {
      const localPath = await gitCommands.cloneRepo(repo.owner, repo.name);
      
      if (localPath) {
        set(state => {
          const clonedRepos = new Set(state.clonedRepos).add(repoId);
          const localPaths = new Map(state.localPaths).set(repoId, localPath);
          const cloningRepos = new Set(state.cloningRepos);
          cloningRepos.delete(repoId);
          const syncStatus = new Map(state.syncStatus).set(repoId, 'synced');
          
          return { clonedRepos, localPaths, cloningRepos, syncStatus };
        });
        return true;
      }
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set(state => {
        const cloningRepos = new Set(state.cloningRepos);
        cloningRepos.delete(repoId);
        const syncStatus = new Map(state.syncStatus).set(repoId, 'error');
        return { error: friendlySyncError(errorMsg), cloningRepos, syncStatus };
      });
      return false;
    }
  },

  isCloned: (repoId) => {
    return get().clonedRepos.has(repoId);
  },

  getLocalPath: (repoId) => {
    return get().localPaths.get(repoId) || null;
  },

  toggleRepoExpanded: (repoId) => {
    const state = get();
    const expandedRepos = new Set(state.expandedRepos);
    
    if (expandedRepos.has(repoId)) {
      expandedRepos.delete(repoId);
      set({ expandedRepos });
    } else {
      if (!state.clonedRepos.has(repoId)) {
        get().cloneRepository(repoId).then(success => {
          if (success) {
            set(s => ({
              expandedRepos: new Set(s.expandedRepos).add(repoId),
            }));
            get().refreshGitStatus(repoId);
          }
        });
      } else {
        expandedRepos.add(repoId);
        set({ expandedRepos });
        get().refreshGitStatus(repoId);
      }
    }
  },

  syncRepository: async (repoId) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo) return;
    
    set(state => ({
      syncStatus: new Map(state.syncStatus).set(repoId, 'syncing'),
    }));

    console.log(`[Sync:Repo] ${repo.name} sync start`);
    const t0 = performance.now();
    try {
      await gitCommands.syncRepo(repo.owner, repo.name, syncCommitMessage());
      await get().refreshGitStatus(repoId);

      console.log(`[Sync:Repo] ${repo.name} sync success ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      set(state => ({
        syncStatus: new Map(state.syncStatus).set(repoId, 'synced'),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync:Repo] ${repo.name} sync error:`, errorMsg);
      set(state => ({
        error: friendlySyncError(errorMsg),
        syncStatus: new Map(state.syncStatus).set(repoId, 'error'),
      }));
    }
  },

  pullChanges: async (repoId) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo) return;

    set(state => ({
      syncStatus: new Map(state.syncStatus).set(repoId, 'syncing'),
    }));

    console.log(`[Sync:Repo] ${repo.name} pull start`);
    const t0 = performance.now();
    try {
      await gitCommands.syncRepo(repo.owner, repo.name, syncCommitMessage());
      await get().refreshGitStatus(repoId);

      console.log(`[Sync:Repo] ${repo.name} pull success ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      set(state => ({
        syncStatus: new Map(state.syncStatus).set(repoId, 'synced'),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync:Repo] ${repo.name} pull error:`, errorMsg);
      set(state => ({
        error: friendlySyncError(errorMsg),
        syncStatus: new Map(state.syncStatus).set(repoId, 'error'),
      }));
    }
  },

  pushChanges: async (repoId) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo) return;

    set(state => ({
      syncStatus: new Map(state.syncStatus).set(repoId, 'syncing'),
    }));

    console.log(`[Sync:Repo] ${repo.name} push start`);
    const t0 = performance.now();
    try {
      await gitCommands.syncRepo(repo.owner, repo.name, syncCommitMessage());
      await get().refreshGitStatus(repoId);

      console.log(`[Sync:Repo] ${repo.name} push success ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      set(state => ({
        syncStatus: new Map(state.syncStatus).set(repoId, 'synced'),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync:Repo] ${repo.name} push error:`, errorMsg);
      set(state => ({
        error: friendlySyncError(errorMsg),
        syncStatus: new Map(state.syncStatus).set(repoId, 'error'),
      }));
    }
  },

  commitChanges: async (repoId, message) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo) return;
    
    try {
      await gitCommands.commitChanges(repo.owner, repo.name, message);
      await get().refreshGitStatus(repoId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ error: friendlySyncError(errorMsg) });
    }
  },

  refreshGitStatus: async (repoId) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo || !get().clonedRepos.has(repoId)) return;
    
    try {
      const status = await gitCommands.getStatus(repo.owner, repo.name);
      
      set(state => {
        const gitStatus = new Map(state.gitStatus).set(repoId, status);
        const syncStatus = new Map(state.syncStatus);
        
        if (status.length > 0) {
          syncStatus.set(repoId, 'has_changes');
        } else if (syncStatus.get(repoId) !== 'syncing') {
          syncStatus.set(repoId, 'synced');
        }
        
        return { gitStatus, syncStatus };
      });
    } catch (error) {
      console.error('Failed to refresh git status:', error);
    }
  },

  getGitStatus: (repoId) => {
    return get().gitStatus.get(repoId) || [];
  },

  hasChanges: (repoId) => {
    const status = get().gitStatus.get(repoId);
    return status ? status.length > 0 : false;
  },

  setSyncStatus: (repoId, status) => {
    set(state => ({
      syncStatus: new Map(state.syncStatus).set(repoId, status),
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  toggleSectionExpanded: () => {
    set(state => ({ sectionExpanded: !state.sectionExpanded }));
  },
}));
