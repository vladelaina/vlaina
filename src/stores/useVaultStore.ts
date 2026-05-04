import { create } from 'zustand';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { normalizeStarredVaultPath, saveStarredRegistry } from '@/stores/notes/starred';
import { moveVaultSystemStore } from '@/stores/notes/systemStoragePaths';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { suspendExternalSync } from '@/stores/notes/document/externalSyncControl';
import { saveDirtyRegularOpenTabs } from '@/stores/notes/dirtyOpenTabs';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { setCurrentVaultPath, useNotesStore } from './useNotesStore';
import { ensureVaultConfig, normalizeVaultPath } from './vaultConfig';
import {
  CURRENT_VAULT_KEY,
  VAULTS_STORAGE_KEY,
  initializeWindowLabel,
  isNativeFilesystemPath,
  loadFromStorage,
  normalizeRecentVaults,
  normalizeVaultInfo,
  queryVaultOpenInOtherWindow,
  closeCurrentVaultAction,
  removeRecentVaultAction,
  resolveRenamedVaultPath,
  saveToStorage,
  setWindowVaultPath,
  setupBroadcastChannel,
  syncCurrentVaultExternalPathAction,
  upsertRecentVault,
  waitForUiRelease,
} from './vaultStoreSupport';

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
  closeVault: () => Promise<boolean>;
  clearError: () => void;
  checkVaultOpenInOtherWindow: (path: string) => Promise<string | null>;
}

type VaultStore = VaultState & VaultActions;

function hasUnsavedDraftTabs(): boolean {
  const notesState = useNotesStore.getState();
  const draftPaths = new Set(
    notesState.openTabs
      .filter((tab) => isDraftNotePath(tab.path))
      .map((tab) => tab.path)
  );

  if (isDraftNotePath(notesState.currentNote?.path)) {
    draftPaths.add(notesState.currentNote.path);
  }

  for (const draftPath of draftPaths) {
    const draftEntry = notesState.draftNotes[draftPath];
    const draftContent = notesState.noteContentsCache.get(draftPath)?.content ?? '';
    const draftMetadata = notesState.noteMetadata?.notes[draftPath];
    if (
      hasDraftUnsavedChanges({
        draftName: draftEntry?.name,
        content: draftContent,
        metadata: draftMetadata,
      })
    ) {
      return true;
    }
  }

  return false;
}

async function prepareNotesForVaultExit(): Promise<{ ok: true } | { ok: false; error: string }> {
  const savedDirtyTabs = await saveDirtyRegularOpenTabs();
  const notesState = useNotesStore.getState();
  const hasDirtyRegularTabs = notesState.openTabs.some(
    (tab) => tab.isDirty && !isDraftNotePath(tab.path)
  );
  const currentRegularStillDirty =
    notesState.isDirty && !isDraftNotePath(notesState.currentNote?.path);

  if (!savedDirtyTabs || hasDirtyRegularTabs || currentRegularStillDirty) {
    return { ok: false, error: 'Failed to save pending note changes' };
  }

  if (hasUnsavedDraftTabs()) {
    return { ok: false, error: 'Save or discard draft notes before switching vaults' };
  }

  return { ok: true };
}

function resetNotesWorkspaceForVaultTransition(notesPath = '') {
  useNotesStore.getState().clearAssetUrlCache();
  useNotesStore.setState({
    currentNote: null,
    currentNoteRevision: 0,
    currentNoteDiskRevision: 0,
    isDirty: false,
    openTabs: [],
    recentlyClosedTabs: [],
    rootFolder: null,
    notesPath,
    draftNotes: {},
    pendingDraftDiscardPath: null,
    pendingDeletedItems: [],
    noteMetadata: null,
    displayNames: new Map(),
    noteContentsCache: new Map(),
    isNewlyCreated: false,
    newlyCreatedFolderPath: null,
    assetList: [],
    isLoadingAssets: false,
    uploadProgress: null,
  });
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

    await initializeWindowLabel();

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
        setWindowVaultPath(currentVault.path);
        setCurrentVaultPath(currentVault.path);
      }
    } else if (currentVaultId && !launchContext.isNewWindow) {
      currentVault = recentVaults.find((vault) => vault.id === currentVaultId) || null;
      if (currentVault) {
        await ensureVaultConfig(currentVault.path);
        setWindowVaultPath(currentVault.path);
        setCurrentVaultPath(currentVault.path);
      } else {
        saveToStorage(CURRENT_VAULT_KEY, null);
      }
    }

    setupBroadcastChannel();

    set({ recentVaults, currentVault });
  },

  checkVaultOpenInOtherWindow: async (path: string): Promise<string | null> => {
    return queryVaultOpenInOtherWindow(path);
  },

  openVault: async (path: string, name?: string) => {
    set({ isLoading: true, error: null });

    try {
      const prepared = await prepareNotesForVaultExit();
      if (!prepared.ok) {
        set({ error: prepared.error, isLoading: false });
        return false;
      }

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

      const previousVault = get().currentVault;
      const previousVaultPath = previousVault?.path ? normalizeVaultPath(previousVault.path) : '';
      if (previousVaultPath !== vault.path) {
        resetNotesWorkspaceForVaultTransition(vault.path);
      }

      set({
        currentVault: vault,
        recentVaults: updatedRecent,
        isLoading: false,
      });

      setWindowVaultPath(vault.path);
      setCurrentVaultPath(vault.path);
      if (previousVaultPath === vault.path) {
        useNotesStore.setState({ notesPath: vault.path });
      }

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
      const prepared = await prepareNotesForVaultExit();
      if (!prepared.ok) {
        set({ error: prepared.error, isLoading: false });
        return false;
      }

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

      const prepared = await prepareNotesForVaultExit();
      if (!prepared.ok) {
        set({ error: prepared.error });
        return false;
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
        resetNotesWorkspaceForVaultTransition();
        await waitForUiRelease();

        markExpectedExternalChange(normalizedCurrentVault.path, true);
        markExpectedExternalChange(nextPath, true);
        await storage.rename(normalizedCurrentVault.path, nextPath);
        await moveVaultSystemStore(normalizedCurrentVault.path, nextPath);

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
        setWindowVaultPath(nextPath);
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
    syncCurrentVaultExternalPathAction({ path, currentVault, recentVaults, set });
  },

  removeFromRecent: (id: string) => {
    const { recentVaults, currentVault } = get();
    removeRecentVaultAction({ id, recentVaults, currentVault, set });
    if (currentVault?.id === id) {
      resetNotesWorkspaceForVaultTransition();
    }
  },

  closeVault: async () => {
    const prepared = await prepareNotesForVaultExit();
    if (!prepared.ok) {
      set({ error: prepared.error });
      return false;
    }

    closeCurrentVaultAction(set);
    resetNotesWorkspaceForVaultTransition();
    set({ error: null });
    return true;
  },

  clearError: () => {
    set({ error: null });
  },
}));
