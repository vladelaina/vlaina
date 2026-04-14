import { create } from 'zustand';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getStorageAdapter, getBaseName, getParentPath, joinPath, isTauri } from '@/lib/storage/adapter';
import { resolveUniqueName } from '@/lib/naming/uniqueName';
import {
  getVaultStarredPaths,
  normalizeStarredVaultPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { readWindowLaunchContext } from '@/lib/tauri/windowLaunchContext';
import { sanitizeFileName } from '@/stores/notes/noteUtils';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { suspendExternalSync } from '@/stores/notes/document/externalSyncControl';
import { setCurrentVaultPath, useNotesStore } from './useNotesStore';
import { ensureVaultConfig, normalizeVaultPath } from './vaultConfig';

export interface VaultInfo {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
}

interface VaultState {
  currentVault: VaultInfo | null;
  recentVaults: VaultInfo[];
  isLoading: boolean;
  error: string | null;
}

interface VaultActions {
  initialize: () => Promise<void>;
  openVault: (path: string, name?: string) => Promise<boolean>;
  createVault: (name: string, path: string) => Promise<boolean>;
  renameCurrentVault: (name: string) => Promise<boolean>;
  syncCurrentVaultExternalPath: (path: string) => void;
  removeFromRecent: (id: string) => void;
  closeVault: () => void;
  clearError: () => void;
  checkVaultOpenInOtherWindow: (path: string) => Promise<string | null>;
}

type VaultStore = VaultState & VaultActions;

const VAULTS_STORAGE_KEY = 'vlaina-vaults';
const CURRENT_VAULT_KEY = 'vlaina-current-vault';
const MAX_RECENT_VAULTS = 5;

function generateVaultId(): string {
  return `vault-${crypto.randomUUID()}`;
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
}

function waitForUiRelease() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 80);
  });
}

function getVaultName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'Untitled';
}

function normalizeVaultInfo(vault: VaultInfo): VaultInfo {
  const normalizedPath = normalizeVaultPath(vault.path);
  return {
    ...vault,
    name: vault.name || getVaultName(normalizedPath),
    path: normalizedPath,
  };
}

function normalizeRecentVaults(vaults: VaultInfo[]): VaultInfo[] {
  const seenPaths = new Set<string>();
  const normalizedVaults: VaultInfo[] = [];

  for (const vault of vaults) {
    const normalizedVault = normalizeVaultInfo(vault);
    if (seenPaths.has(normalizedVault.path)) {
      continue;
    }

    seenPaths.add(normalizedVault.path);
    normalizedVaults.push(normalizedVault);
  }

  return normalizedVaults.slice(0, MAX_RECENT_VAULTS);
}

function upsertRecentVault(
  recentVaults: VaultInfo[],
  path: string,
  name?: string
) {
  const normalizedPath = normalizeVaultPath(path);
  const vaultName = name || getVaultName(normalizedPath);
  const existingVault = recentVaults.find((candidate) => candidate.path === normalizedPath);

  const vault = existingVault
    ? { ...existingVault, name: vaultName, lastOpened: Date.now() }
    : {
        id: generateVaultId(),
        name: vaultName,
        path: normalizedPath,
        lastOpened: Date.now(),
      };

  return {
    vault,
    recentVaults: normalizeRecentVaults([
      vault,
      ...recentVaults.filter((candidate) => candidate.path !== normalizedPath),
    ]),
  };
}

async function resolveRenamedVaultPath(currentPath: string, nextName: string) {
  const storage = getStorageAdapter();
  const parentPath = getParentPath(currentPath);
  if (!parentPath) {
    throw new Error('Cannot rename the current vault at this path');
  }

  const currentFolderName = getBaseName(currentPath);
  const desiredName = sanitizeFileName(nextName);
  const resolvedName = await resolveUniqueName(desiredName, async (candidateName) => {
    if (candidateName === currentFolderName) {
      return false;
    }

    const candidatePath = await joinPath(parentPath, candidateName);
    return storage.exists(candidatePath);
  });

  return {
    name: resolvedName,
    path: normalizeVaultPath(await joinPath(parentPath, resolvedName)),
  };
}

function isNativeFilesystemPath(path: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  if (path.startsWith('~')) return true;
  if (/^\/(?:Users|home|var|etc|usr|opt|tmp|root|mnt|media|System|Library|Applications|Volumes)(?:\/|$)/i.test(path)) return true;
  return false;
}

let windowVaultPath: string | null = null;
let windowLabel: string | null = null;
let vaultChannel: BroadcastChannel | null = null;
let pendingQueries: Map<string, (label: string | null) => void> = new Map();

function setupBroadcastChannel() {
  if (vaultChannel) return;

  vaultChannel = new BroadcastChannel('vlaina-vault');

  vaultChannel.onmessage = (event) => {
    const { type, requestId, vaultPath, responseLabel } = event.data;

    if (type === 'query' && windowVaultPath === vaultPath && windowLabel) {
      vaultChannel?.postMessage({
        type: 'response',
        requestId,
        responseLabel: windowLabel,
      });
    } else if (type === 'response' && pendingQueries.has(requestId)) {
      const resolve = pendingQueries.get(requestId);
      pendingQueries.delete(requestId);
      resolve?.(responseLabel);
    }
  };
}

async function getCurrentWindowLabel(): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    return getCurrentWindow().label;
  } catch {
    return null;
  }
}

export const useVaultStore = create<VaultStore>()((set, get) => ({
  currentVault: null,
  recentVaults: [],
  isLoading: false,
  error: null,

  initialize: async () => {
    const storage = getStorageAdapter();
    const savedVaults = normalizeRecentVaults(loadFromStorage<VaultInfo[]>(VAULTS_STORAGE_KEY, []));
    const currentVaultId = loadFromStorage<string | null>(CURRENT_VAULT_KEY, null);
    const isWebPlatform = storage.platform === 'web';
    const launchContext = readWindowLaunchContext();
    const requestedVaultPath = launchContext.vaultPath
      ? normalizeVaultPath(launchContext.vaultPath)
      : null;

    windowLabel = await getCurrentWindowLabel();

    const existChecks = await Promise.all(
      savedVaults.map(async (vault) => {
        if (isWebPlatform && isNativeFilesystemPath(vault.path)) {
          return { vault, exists: false };
        }
        return { vault, exists: await storage.exists(vault.path) };
      })
    );
    let recentVaults = normalizeRecentVaults(
      existChecks.filter((candidate) => candidate.exists).map((candidate) => candidate.vault)
    );

    if (recentVaults.length !== savedVaults.length) {
      saveToStorage(VAULTS_STORAGE_KEY, recentVaults);
    }

    let currentVault: VaultInfo | null = null;
    if (requestedVaultPath) {
      const requestedVaultExists =
        !isWebPlatform || !isNativeFilesystemPath(requestedVaultPath)
          ? await storage.exists(requestedVaultPath)
          : false;

      if (requestedVaultExists) {
        await ensureVaultConfig(requestedVaultPath);
        const nextVaultState = upsertRecentVault(recentVaults, requestedVaultPath);
        recentVaults = nextVaultState.recentVaults;
        currentVault = nextVaultState.vault;
        saveToStorage(VAULTS_STORAGE_KEY, recentVaults);
        saveToStorage(CURRENT_VAULT_KEY, currentVault.id);
        windowVaultPath = currentVault.path;
        setCurrentVaultPath(currentVault.path);
      }
    } else if (currentVaultId && !launchContext.isNewWindow) {
      currentVault = recentVaults.find((vault) => vault.id === currentVaultId) || null;
      if (currentVault) {
        await ensureVaultConfig(currentVault.path);
        windowVaultPath = currentVault.path;
        setCurrentVaultPath(currentVault.path);
      } else {
        saveToStorage(CURRENT_VAULT_KEY, null);
      }
    }

    setupBroadcastChannel();

    set({ recentVaults, currentVault });
  },

  checkVaultOpenInOtherWindow: async (path: string): Promise<string | null> => {
    const normalizedPath = normalizeVaultPath(path);
    const requestId = `req-${crypto.randomUUID()}`;

    return new Promise((resolve) => {
      pendingQueries.set(requestId, resolve);

      vaultChannel?.postMessage({
        type: 'query',
        requestId,
        vaultPath: normalizedPath,
      });

      setTimeout(() => {
        if (pendingQueries.has(requestId)) {
          pendingQueries.delete(requestId);
          resolve(null);
        }
      }, 150);
    });
  },

  openVault: async (path: string, name?: string) => {
    set({ isLoading: true, error: null });

    try {
      const storage = getStorageAdapter();

      if (storage.platform === 'web' && isNativeFilesystemPath(path)) {
        set({ error: 'Invalid path for web platform', isLoading: false });
        return false;
      }

      const normalizedPath = normalizeVaultPath(path);
      const pathExists = await storage.exists(normalizedPath);
      if (!pathExists) {
        set({ error: 'Folder does not exist or cannot be accessed', isLoading: false });
        return false;
      }

      await ensureVaultConfig(normalizedPath);

      const nextVaultState = upsertRecentVault(
        normalizeRecentVaults(get().recentVaults),
        normalizedPath,
        name
      );
      const vault = nextVaultState.vault;
      const updatedRecent = nextVaultState.recentVaults;

      saveToStorage(VAULTS_STORAGE_KEY, updatedRecent);
      saveToStorage(CURRENT_VAULT_KEY, vault.id);

      set({
        currentVault: vault,
        recentVaults: updatedRecent,
        isLoading: false,
      });

      windowVaultPath = vault.path;
      setCurrentVaultPath(vault.path);

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open vault',
        isLoading: false,
      });
      return false;
    }
  },

  createVault: async (name: string, path: string) => {
    set({ isLoading: true, error: null });

    try {
      const storage = getStorageAdapter();
      const normalizedPath = normalizeVaultPath(path);
      const pathExists = await storage.exists(normalizedPath);
      if (!pathExists) {
        await storage.mkdir(normalizedPath, true);
      }

      await ensureVaultConfig(normalizedPath);

      return await get().openVault(normalizedPath, name);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create vault',
        isLoading: false,
      });
      return false;
    }
  },

  renameCurrentVault: async (name: string) => {
    const { currentVault, recentVaults } = get();
    if (!currentVault) {
      return false;
    }

    try {
      const storage = getStorageAdapter();
      const notesState = useNotesStore.getState();
      const normalizedCurrentVault = normalizeVaultInfo(currentVault);
      const normalizedRecentVaults = normalizeRecentVaults(recentVaults);
      const trimmedName = name.trim();
      if (!trimmedName) {
        return false;
      }

      if (notesState.isDirty) {
        await notesState.saveNote();
        if (useNotesStore.getState().isDirty) {
          return false;
        }
      }

      const { name: nextName, path: nextPath } = await resolveRenamedVaultPath(
        normalizedCurrentVault.path,
        trimmedName
      );

      if (nextPath === normalizedCurrentVault.path && nextName === normalizedCurrentVault.name) {
        return true;
      }

      const resumeExternalSync = await suspendExternalSync();
      const previousVault = normalizedCurrentVault;

      try {
        set({ currentVault: null });
        useNotesStore.getState().clearAssetUrlCache();
        useNotesStore.setState({
          currentNote: null,
          openTabs: [],
          rootFolder: null,
          notesPath: '',
        });
        await waitForUiRelease();

        markExpectedExternalChange(normalizedCurrentVault.path, true);
        markExpectedExternalChange(nextPath, true);
        await storage.rename(normalizedCurrentVault.path, nextPath);

        const nextVault = normalizeVaultInfo({
          ...normalizedCurrentVault,
          name: nextName,
          path: nextPath,
          lastOpened: Date.now(),
        });
        const nextRecentVaults = normalizeRecentVaults([
          nextVault,
          ...normalizedRecentVaults.filter(
            (vault) => vault.id !== normalizedCurrentVault.id && vault.path !== nextPath
          ),
        ]);

        saveToStorage(VAULTS_STORAGE_KEY, nextRecentVaults);
        saveToStorage(CURRENT_VAULT_KEY, nextVault.id);

        const normalizedCurrentVaultPath = normalizeStarredVaultPath(normalizedCurrentVault.path);
        const nextStarredEntries = notesState.starredEntries.map((entry) =>
          normalizeStarredVaultPath(entry.vaultPath) === normalizedCurrentVaultPath
            ? { ...entry, vaultPath: nextPath }
            : entry
        );
        useNotesStore.setState({
          starredEntries: nextStarredEntries,
        });
        saveStarredRegistry(nextStarredEntries);
        windowVaultPath = nextPath;
        setCurrentVaultPath(nextPath);
        set({
          currentVault: nextVault,
          recentVaults: nextRecentVaults,
          error: null,
        });

        const reopened = await get().openVault(nextPath, nextName);
        if (!reopened) {
          throw new Error('Vault rename succeeded but reopening the renamed vault failed');
        }

        return true;
      } catch (error) {
        await get().openVault(previousVault.path, previousVault.name);
        throw error;
      } finally {
        resumeExternalSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename vault' });
      return false;
    }
  },

  syncCurrentVaultExternalPath: (path: string) => {
    const { currentVault, recentVaults } = get();
    if (!currentVault) {
      return;
    }

    const normalizedPath = normalizeVaultPath(path);
    const normalizedCurrentVault = normalizeVaultInfo(currentVault);
    const normalizedCurrentVaultPath = normalizeVaultPath(normalizedCurrentVault.path);
    if (!normalizedPath || normalizedPath === normalizedCurrentVaultPath) {
      return;
    }

    const nextVault = normalizeVaultInfo({
      ...normalizedCurrentVault,
      name: getVaultName(normalizedPath),
      path: normalizedPath,
      lastOpened: Date.now(),
    });
    const nextRecentVaults = normalizeRecentVaults([
      nextVault,
      ...normalizeRecentVaults(recentVaults).filter(
        (vault) => vault.id !== normalizedCurrentVault.id && vault.path !== normalizedPath
      ),
    ]);

    saveToStorage(VAULTS_STORAGE_KEY, nextRecentVaults);
    saveToStorage(CURRENT_VAULT_KEY, nextVault.id);

    const notesState = useNotesStore.getState();
    const normalizedStarredVaultPath = normalizeStarredVaultPath(normalizedCurrentVaultPath);
    const nextStarredEntries = notesState.starredEntries.map((entry) =>
      normalizeStarredVaultPath(entry.vaultPath) === normalizedStarredVaultPath
        ? { ...entry, vaultPath: normalizedPath }
        : entry
    );
    const nextStarredPaths = getVaultStarredPaths(nextStarredEntries, normalizedPath);
    const pendingStarredNavigation = notesState.pendingStarredNavigation;
    const nextPendingStarredNavigation =
      pendingStarredNavigation &&
      normalizeStarredVaultPath(pendingStarredNavigation.vaultPath) === normalizedStarredVaultPath
        ? { ...pendingStarredNavigation, vaultPath: normalizedPath }
        : pendingStarredNavigation;

    windowVaultPath = normalizedPath;
    setCurrentVaultPath(normalizedPath);

    notesState.clearAssetUrlCache();
    useNotesStore.setState({
      notesPath: normalizedPath,
      starredEntries: nextStarredEntries,
      starredNotes: nextStarredPaths.notes,
      starredFolders: nextStarredPaths.folders,
      pendingStarredNavigation: nextPendingStarredNavigation,
    });
    void saveStarredRegistry(nextStarredEntries);

    set({
      currentVault: nextVault,
      recentVaults: nextRecentVaults,
      error: null,
    });
  },

  removeFromRecent: (id: string) => {
    const { recentVaults, currentVault } = get();
    const updatedRecent = recentVaults.filter((vault) => vault.id !== id);

    saveToStorage(VAULTS_STORAGE_KEY, updatedRecent);

    if (currentVault?.id === id) {
      saveToStorage(CURRENT_VAULT_KEY, null);
      set({ currentVault: null, recentVaults: updatedRecent });
    } else {
      set({ recentVaults: updatedRecent });
    }
  },

  closeVault: () => {
    saveToStorage(CURRENT_VAULT_KEY, null);
    windowVaultPath = null;
    setCurrentVaultPath(null);
    set({ currentVault: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
