/**
 * GitHub Repos Store - State management for GitHub repository browsing
 * 
 * Manages repository list, file tree cache, pending changes, and sync status
 * for the GitHub sidebar feature.
 */

import { create } from 'zustand';
import { 
  githubRepoCommands, 
  hasBackendCommands,
  type RepositoryInfo, 
  type TreeEntry, 
  type FileContent 
} from '@/lib/tauri/invoke';
import { useGithubSyncStore } from './useGithubSyncStore';

/** Sync status for a repository */
export type SyncStatus = 'synced' | 'syncing' | 'has_updates' | 'error' | 'pending';

/** Currently open remote file */
export interface RemoteFile {
  repoId: number;
  owner: string;
  repo: string;
  path: string;
  content: string;
  sha: string;
  originalContent: string;
}

interface GithubReposState {
  // Repository list
  repositories: RepositoryInfo[];
  isLoadingRepos: boolean;
  
  // Expanded state
  expandedRepos: Set<number>;
  
  // File tree cache: repoId -> path -> TreeEntry[]
  fileTreeCache: Map<number, Map<string, TreeEntry[]>>;
  loadingPaths: Set<string>; // Format: `${repoId}:${path}`
  
  // File content cache
  fileContentCache: Map<string, FileContent>; // key: `${repoId}:${path}`
  
  // Pending changes: repoId -> Set<filePath>
  pendingChanges: Map<number, Set<string>>;
  
  // Sync status per repository
  syncStatus: Map<number, SyncStatus>;
  
  // Currently open remote file
  currentRemoteFile: RemoteFile | null;
  
  // Error state
  error: string | null;
  
  // Section expanded state
  sectionExpanded: boolean;
}

interface GithubReposActions {
  // Repository operations
  loadRepositories: () => Promise<void>;
  createRepository: (name: string, isPrivate: boolean, description?: string) => Promise<RepositoryInfo | null>;
  removeRepository: (repoId: number) => void;
  
  // File tree operations
  toggleRepoExpanded: (repoId: number) => void;
  loadDirectory: (repoId: number, owner: string, repo: string, path: string) => Promise<void>;
  getTreeEntries: (repoId: number, path: string) => TreeEntry[] | null;
  
  // File operations
  openRemoteFile: (repoId: number, owner: string, repo: string, path: string) => Promise<void>;
  updateRemoteFileContent: (content: string) => void;
  closeRemoteFile: () => void;
  
  // Sync operations
  pushChanges: (repoId: number) => Promise<boolean>;
  pullChanges: (repoId: number) => Promise<void>;
  syncRepository: (repoId: number) => Promise<void>;
  
  // State management
  setSyncStatus: (repoId: number, status: SyncStatus) => void;
  clearError: () => void;
  toggleSectionExpanded: () => void;
  
  // Helpers
  hasPendingChanges: (repoId: number) => boolean;
  getPendingFilesCount: (repoId: number) => number;
}

type GithubReposStore = GithubReposState & GithubReposActions;

const initialState: GithubReposState = {
  repositories: [],
  isLoadingRepos: false,
  expandedRepos: new Set(),
  fileTreeCache: new Map(),
  loadingPaths: new Set(),
  fileContentCache: new Map(),
  pendingChanges: new Map(),
  syncStatus: new Map(),
  currentRemoteFile: null,
  error: null,
  sectionExpanded: true,
};

export const useGithubReposStore = create<GithubReposStore>((set, get) => ({
  ...initialState,

  loadRepositories: async () => {
    // Check if connected to GitHub
    const { isConnected } = useGithubSyncStore.getState();
    if (!isConnected || !hasBackendCommands()) {
      set({ repositories: [], isLoadingRepos: false });
      return;
    }

    set({ isLoadingRepos: true, error: null });
    
    try {
      const repos = await githubRepoCommands.listRepos();
      set({ 
        repositories: repos, 
        isLoadingRepos: false,
      });
      
      // Initialize sync status for each repo
      const syncStatus = new Map<number, SyncStatus>();
      repos.forEach(repo => {
        syncStatus.set(repo.id, 'synced');
      });
      set({ syncStatus });
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
      set({ error: 'Repository creation is not available on this platform' });
      return null;
    }

    try {
      const repo = await githubRepoCommands.createRepo(name, isPrivate, description);
      if (repo) {
        set(state => ({
          repositories: [repo, ...state.repositories],
          syncStatus: new Map(state.syncStatus).set(repo.id, 'synced'),
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
      
      const fileTreeCache = new Map(state.fileTreeCache);
      fileTreeCache.delete(repoId);
      
      const pendingChanges = new Map(state.pendingChanges);
      pendingChanges.delete(repoId);
      
      const syncStatus = new Map(state.syncStatus);
      syncStatus.delete(repoId);
      
      return { repositories, expandedRepos, fileTreeCache, pendingChanges, syncStatus };
    });
  },

  toggleRepoExpanded: (repoId) => {
    set(state => {
      const expandedRepos = new Set(state.expandedRepos);
      if (expandedRepos.has(repoId)) {
        expandedRepos.delete(repoId);
      } else {
        expandedRepos.add(repoId);
        // Load root directory if not cached
        const repo = state.repositories.find(r => r.id === repoId);
        if (repo && !state.fileTreeCache.get(repoId)?.has('')) {
          get().loadDirectory(repoId, repo.owner, repo.name, '');
        }
      }
      return { expandedRepos };
    });
  },

  loadDirectory: async (repoId, owner, repo, path) => {
    const cacheKey = `${repoId}:${path}`;
    
    // Check cache first
    const cached = get().fileTreeCache.get(repoId)?.get(path);
    if (cached) return;
    
    // Check if already loading
    if (get().loadingPaths.has(cacheKey)) return;
    
    set(state => ({
      loadingPaths: new Set(state.loadingPaths).add(cacheKey),
    }));

    try {
      const entries = await githubRepoCommands.getRepoTree(owner, repo, path);
      
      set(state => {
        const fileTreeCache = new Map(state.fileTreeCache);
        const repoCache = fileTreeCache.get(repoId) || new Map();
        repoCache.set(path, entries);
        fileTreeCache.set(repoId, repoCache);
        
        const loadingPaths = new Set(state.loadingPaths);
        loadingPaths.delete(cacheKey);
        
        return { fileTreeCache, loadingPaths };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set(state => {
        const loadingPaths = new Set(state.loadingPaths);
        loadingPaths.delete(cacheKey);
        return { loadingPaths, error: errorMsg };
      });
    }
  },

  getTreeEntries: (repoId, path) => {
    return get().fileTreeCache.get(repoId)?.get(path) || null;
  },

  openRemoteFile: async (repoId, owner, repo, path) => {
    const cacheKey = `${repoId}:${path}`;
    
    // Check cache first
    const cached = get().fileContentCache.get(cacheKey);
    if (cached) {
      set({
        currentRemoteFile: {
          repoId,
          owner,
          repo,
          path,
          content: cached.content,
          sha: cached.sha,
          originalContent: cached.content,
        },
      });
      return;
    }

    try {
      const fileContent = await githubRepoCommands.getFileContent(owner, repo, path);
      if (fileContent) {
        // Cache the content
        set(state => {
          const fileContentCache = new Map(state.fileContentCache);
          fileContentCache.set(cacheKey, fileContent);
          return {
            fileContentCache,
            currentRemoteFile: {
              repoId,
              owner,
              repo,
              path,
              content: fileContent.content,
              sha: fileContent.sha,
              originalContent: fileContent.content,
            },
          };
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ error: errorMsg });
    }
  },

  updateRemoteFileContent: (content) => {
    const { currentRemoteFile } = get();
    if (!currentRemoteFile) return;

    const isModified = content !== currentRemoteFile.originalContent;
    
    set(state => {
      const pendingChanges = new Map(state.pendingChanges);
      const repoChanges = pendingChanges.get(currentRemoteFile.repoId) || new Set();
      
      if (isModified) {
        repoChanges.add(currentRemoteFile.path);
      } else {
        repoChanges.delete(currentRemoteFile.path);
      }
      
      pendingChanges.set(currentRemoteFile.repoId, repoChanges);
      
      // Update sync status
      const syncStatus = new Map(state.syncStatus);
      if (repoChanges.size > 0) {
        syncStatus.set(currentRemoteFile.repoId, 'pending');
      } else {
        syncStatus.set(currentRemoteFile.repoId, 'synced');
      }
      
      return {
        currentRemoteFile: { ...currentRemoteFile, content },
        pendingChanges,
        syncStatus,
      };
    });
  },

  closeRemoteFile: () => {
    set({ currentRemoteFile: null });
  },

  pushChanges: async (repoId) => {
    const state = get();
    const repo = state.repositories.find(r => r.id === repoId);
    const pendingFiles = state.pendingChanges.get(repoId);
    
    if (!repo || !pendingFiles || pendingFiles.size === 0) {
      return false;
    }

    set(state => ({
      syncStatus: new Map(state.syncStatus).set(repoId, 'syncing'),
    }));

    try {
      // Push each pending file
      for (const filePath of pendingFiles) {
        const cacheKey = `${repoId}:${filePath}`;
        const cached = state.fileContentCache.get(cacheKey);
        
        if (cached) {
          // Get current content (might be modified)
          let content = cached.content;
          if (state.currentRemoteFile?.repoId === repoId && 
              state.currentRemoteFile?.path === filePath) {
            content = state.currentRemoteFile.content;
          }
          
          const result = await githubRepoCommands.updateFile(
            repo.owner,
            repo.name,
            filePath,
            content,
            cached.sha,
            `Update ${filePath} via NekoTick`
          );
          
          if (result) {
            // Update cache with new SHA
            set(state => {
              const fileContentCache = new Map(state.fileContentCache);
              fileContentCache.set(cacheKey, {
                ...cached,
                content,
                sha: result.sha,
              });
              return { fileContentCache };
            });
          }
        }
      }

      // Clear pending changes and update status
      set(state => {
        const pendingChanges = new Map(state.pendingChanges);
        pendingChanges.set(repoId, new Set());
        
        const syncStatus = new Map(state.syncStatus);
        syncStatus.set(repoId, 'synced');
        
        // Update current file if it was pushed
        let currentRemoteFile = state.currentRemoteFile;
        if (currentRemoteFile?.repoId === repoId) {
          currentRemoteFile = {
            ...currentRemoteFile,
            originalContent: currentRemoteFile.content,
          };
        }
        
        return { pendingChanges, syncStatus, currentRemoteFile };
      });

      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set(state => ({
        error: errorMsg,
        syncStatus: new Map(state.syncStatus).set(repoId, 'error'),
      }));
      return false;
    }
  },

  pullChanges: async (repoId) => {
    const repo = get().repositories.find(r => r.id === repoId);
    if (!repo) return;

    set(state => ({
      syncStatus: new Map(state.syncStatus).set(repoId, 'syncing'),
    }));

    try {
      // Clear cache for this repo to force reload
      set(state => {
        const fileTreeCache = new Map(state.fileTreeCache);
        fileTreeCache.delete(repoId);
        
        // Clear file content cache for this repo
        const fileContentCache = new Map(state.fileContentCache);
        for (const key of fileContentCache.keys()) {
          if (key.startsWith(`${repoId}:`)) {
            fileContentCache.delete(key);
          }
        }
        
        return { fileTreeCache, fileContentCache };
      });

      // Reload root directory
      await get().loadDirectory(repoId, repo.owner, repo.name, '');

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

  syncRepository: async (repoId) => {
    // First push any pending changes
    const hasPending = get().hasPendingChanges(repoId);
    if (hasPending) {
      const pushSuccess = await get().pushChanges(repoId);
      if (!pushSuccess) return;
    }
    
    // Then pull latest changes
    await get().pullChanges(repoId);
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

  hasPendingChanges: (repoId) => {
    const changes = get().pendingChanges.get(repoId);
    return changes ? changes.size > 0 : false;
  },

  getPendingFilesCount: (repoId) => {
    const changes = get().pendingChanges.get(repoId);
    return changes ? changes.size : 0;
  },
}));

// ==================== Helper Functions ====================

/** Get display name by removing nekotick- prefix */
export function getDisplayName(name: string): string {
  const prefix = 'nekotick-';
  if (name.startsWith(prefix)) {
    return name.slice(prefix.length);
  }
  return name;
}

/** Filter repositories to only include nekotick- prefixed ones */
export function filterNekotickRepos(repos: RepositoryInfo[]): RepositoryInfo[] {
  return repos.filter(r => r.name.startsWith('nekotick-'));
}

/** Get sync status icon */
export function getSyncStatusIcon(status: SyncStatus): string {
  switch (status) {
    case 'synced': return '✓';
    case 'syncing': return '↻';
    case 'has_updates': return '●';
    case 'error': return '⚠';
    case 'pending': return '○';
    default: return '';
  }
}
