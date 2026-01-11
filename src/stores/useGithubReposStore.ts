/**
 * GitHub Repos Store - State management for GitHub repository browsing
 * 
 * Uses local git clone for offline support.
 * Repositories are cloned to local storage and synced with remote.
 */

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

/** Sync status for a repository */
export type SyncStatus = 'synced' | 'syncing' | 'has_changes' | 'error' | 'not_cloned';

// Re-export types for convenience
export type { FileStatus, CommitInfo };

interface GithubReposState {
  // Repository list (from GitHub API)
  repositories: RepositoryInfo[];
  isLoadingRepos: boolean;
  
  // Expanded state
  expandedRepos: Set<number>;
  
  // Local paths: repoId -> local path
  localPaths: Map<number, string>;
  
  // Clone status: repoId -> boolean
  clonedRepos: Set<number>;
  
  // Sync status per repository
  syncStatus: Map<number, SyncStatus>;
  
  // Git status per repository: repoId -> FileStatus[]
  gitStatus: Map<number, FileStatus[]>;
  
  // Error state
  error: string | null;
  
  // Section expanded state
  sectionExpanded: boolean;
  
  // Loading states
  cloningRepos: Set<number>;
}

interface GithubReposActions {
  // Repository operations
  loadRepositories: () => Promise<void>;
  createRepository: (name: string, isPrivate: boolean, description?: string) => Promise<RepositoryInfo | null>;
  removeRepository: (repoId: number) => void;
  
  // Clone operations
  cloneRepository: (repoId: number) => Promise<boolean>;
  isCloned: (repoId: number) => boolean;
  getLocalPath: (repoId: number) => string | null;
  
  // Expand/collapse
  toggleRepoExpanded: (repoId: number) => void;
  
  // Sync operations
  syncRepository: (repoId: number) => Promise<void>;
  pullChanges: (repoId: number) => Promise<void>;
  pushChanges: (repoId: number) => Promise<void>;
  commitChanges: (repoId: number, message: string) => Promise<void>;
  
  // Git status
  refreshGitStatus: (repoId: number) => Promise<void>;
  getGitStatus: (repoId: number) => FileStatus[];
  hasChanges: (repoId: number) => boolean;
  
  // State management
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
  sectionExpanded: false, // Default collapsed, will expand when connected
  cloningRepos: new Set(),
};

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
      const repos = await githubRepoCommands.listRepos();
      
      // Check which repos are already cloned
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
      
      // Auto-clone uncloned repos in background (don't await, let it run async)
      if (reposToClone.length > 0) {
        // Clone repos one by one in background
        (async () => {
          for (const repo of reposToClone) {
            try {
              await get().cloneRepository(repo.id);
            } catch (e) {
              // Silently fail for background clones
              console.error(`Failed to auto-clone ${repo.name}:`, e);
            }
          }
        })();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ 
        error: errorMsg, 
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
      set({ error: errorMsg });
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
    
    // Mark as cloning
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
        return { error: errorMsg, cloningRepos, syncStatus };
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
      // If not cloned, clone first
      if (!state.clonedRepos.has(repoId)) {
        get().cloneRepository(repoId).then(success => {
          if (success) {
            set(s => ({
              expandedRepos: new Set(s.expandedRepos).add(repoId),
            }));
            // Refresh git status after clone
            get().refreshGitStatus(repoId);
          }
        });
      } else {
        expandedRepos.add(repoId);
        set({ expandedRepos });
        // Refresh git status when expanding
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
    
    try {
      // First commit any local changes
      const status = get().gitStatus.get(repoId) || [];
      if (status.length > 0) {
        await gitCommands.commitChanges(repo.owner, repo.name, 'Sync changes from NekoTick');
      }
      
      // Pull remote changes
      await gitCommands.pullRepo(repo.owner, repo.name);
      
      // Push local changes
      await gitCommands.pushRepo(repo.owner, repo.name);
      
      // Refresh status
      await get().refreshGitStatus(repoId);
      
      set(state => ({
        syncStatus: new Map(state.syncStatus).set(repoId, 'synced'),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set(state => ({
        error: errorMsg,
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
    
    try {
      await gitCommands.pullRepo(repo.owner, repo.name);
      await get().refreshGitStatus(repoId);
      
      set(state => ({
        syncStatus: new Map(state.syncStatus).set(repoId, 'synced'),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set(state => ({
        error: errorMsg,
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
    
    try {
      // Commit first if there are changes
      const status = get().gitStatus.get(repoId) || [];
      if (status.length > 0) {
        await gitCommands.commitChanges(repo.owner, repo.name, 'Update from NekoTick');
      }
      
      await gitCommands.pushRepo(repo.owner, repo.name);
      await get().refreshGitStatus(repoId);
      
      set(state => ({
        syncStatus: new Map(state.syncStatus).set(repoId, 'synced'),
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set(state => ({
        error: errorMsg,
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
      set({ error: errorMsg });
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
        
        // Update sync status based on git status
        if (status.length > 0) {
          syncStatus.set(repoId, 'has_changes');
        } else if (syncStatus.get(repoId) !== 'syncing') {
          syncStatus.set(repoId, 'synced');
        }
        
        return { gitStatus, syncStatus };
      });
    } catch (error) {
      // Silently fail - status refresh is not critical
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
