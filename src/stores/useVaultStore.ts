import { create } from 'zustand';
import { recordDiagnostic } from '@/lib/diagnostics/appDiagnostics';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import {
  findStarredEntryByPath,
  getStarredEntryAbsolutePath,
  normalizeStarredVaultPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { moveVaultSystemStore } from '@/stores/notes/systemStoragePaths';
import {
  flushPendingDeletedItemsToSystemTrash,
  flushStalePendingTrashForVault,
} from '@/stores/notes/utils/fs/trashOperations';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { suspendExternalSync } from '@/stores/notes/document/externalSyncControl';
import { saveAutoSaveableDrafts } from '@/stores/notes/autoSaveableDrafts';
import { saveDirtyRegularOpenTabs } from '@/stores/notes/dirtyOpenTabs';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import type { MetadataFile, NotesStore } from '@/stores/notes/types';
import { setCurrentVaultPath, useNotesStore } from './useNotesStore';
import { ensureVaultConfig, normalizeVaultPath } from './vaultConfig';
import {
  VAULTS_STORAGE_KEY,
  initializeWindowLabel,
  isNativeFilesystemPath,
  loadPersistedVaultState,
  normalizeRecentVaults,
  normalizeVaultInfo,
  isOversizedRecentVaultsStorageValue,
  parseRecentVaultsStorageValue,
  persistVaultState,
  queryVaultOpenInOtherWindow,
  closeCurrentVaultAction,
  removeRecentVaultAction,
  resolveRenamedVaultPath,
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
  hasInitialized: boolean;
  error: string | null;
}

interface VaultActions {
  initialize: () => Promise<void>;
  openVault: (path: string, name?: string, options?: { preserveSidebarTree?: boolean }) => Promise<boolean>;
  createVault: (name: string, path: string) => Promise<boolean>;
  renameCurrentVault: (name: string) => Promise<boolean>;
  syncCurrentVaultExternalPath: (path: string) => void;
  removeFromRecent: (id: string) => Promise<boolean>;
  closeVault: () => Promise<boolean>;
  clearError: () => void;
  checkVaultOpenInOtherWindow: (path: string) => Promise<string | null>;
}

type VaultStore = VaultState & VaultActions;

type PreservedDraftWorkspace = Pick<
  NotesStore,
  | 'currentNote'
  | 'currentNoteRevision'
  | 'isDirty'
  | 'openTabs'
  | 'draftNotes'
  | 'pendingDraftDiscardPath'
  | 'noteContentsCache'
  | 'noteMetadata'
> | null;

type PreservedExternalWorkspace = Pick<
  NotesStore,
  | 'currentNote'
  | 'currentNoteRevision'
  | 'isDirty'
  | 'openTabs'
  | 'noteContentsCache'
  | 'noteMetadata'
  | 'displayNames'
> | null;

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

  Object.keys(notesState.draftNotes).forEach((path) => {
    if (isDraftNotePath(path)) {
      draftPaths.add(path);
    }
  });

  for (const draftPath of draftPaths) {
    const draftEntry = notesState.draftNotes[draftPath];
    const draftContent = notesState.currentNote?.path === draftPath
      ? notesState.currentNote.content
      : notesState.noteContentsCache.get(draftPath)?.content ?? '';
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

async function prepareNotesForVaultExit(
  options: { blockUnsavedDrafts?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const savedAutoSaveableDrafts = await saveAutoSaveableDrafts();
  if (!savedAutoSaveableDrafts) {
    return { ok: false, error: 'Failed to save pending draft changes' };
  }

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

  if (options.blockUnsavedDrafts !== false && hasUnsavedDraftTabs()) {
    return { ok: false, error: 'Save or discard draft notes before switching vaults' };
  }

  return { ok: true };
}

function collectDraftWorkspaceForVaultTransition(): PreservedDraftWorkspace {
  const state = useNotesStore.getState();
  const draftPaths = new Set(Object.keys(state.draftNotes));
  state.openTabs.forEach((tab) => {
    if (isDraftNotePath(tab.path)) draftPaths.add(tab.path);
  });
  if (isDraftNotePath(state.currentNote?.path)) {
    draftPaths.add(state.currentNote.path);
  }

  if (draftPaths.size === 0) {
    return null;
  }

  const openTabs = state.openTabs.filter((tab) => draftPaths.has(tab.path));
  const currentNote = state.currentNote && draftPaths.has(state.currentNote.path)
    ? state.currentNote
    : null;
  const draftNotes = Object.fromEntries(
    Object.entries(state.draftNotes)
      .filter(([path]) => draftPaths.has(path))
      .map(([path, draftNote]) => [
        path,
        {
          ...draftNote,
          originNotesPath: draftNote.originNotesPath ?? state.notesPath,
        },
      ]),
  );
  const noteContentsCache = new Map(
    [...state.noteContentsCache.entries()].filter(([path]) => draftPaths.has(path)),
  );
  const draftMetadataEntries = Object.entries(state.noteMetadata?.notes ?? {})
    .filter(([path]) => draftPaths.has(path));
  const noteMetadata: MetadataFile | null = draftMetadataEntries.length > 0
    ? { version: 1, notes: Object.fromEntries(draftMetadataEntries) }
    : null;

  const preservedWorkspace = {
    currentNote,
    currentNoteRevision: currentNote ? state.currentNoteRevision : 0,
    isDirty: currentNote ? state.isDirty : false,
    openTabs,
    draftNotes,
    pendingDraftDiscardPath:
      state.pendingDraftDiscardPath && draftPaths.has(state.pendingDraftDiscardPath)
        ? state.pendingDraftDiscardPath
        : null,
    noteContentsCache,
    noteMetadata,
  };
  return preservedWorkspace;
}

function isExternalAbsoluteNotePath(path: string | null | undefined, notesPath: string) {
  if (!path || !isAbsolutePath(path)) {
    return false;
  }

  const normalizedPath = normalizeVaultPath(path);
  const normalizedNotesPath = normalizeVaultPath(notesPath);
  if (normalizedNotesPath === '/') {
    return false;
  }

  const normalizedNotesPathPrefix = normalizedNotesPath.replace(/\/+$/, '');
  return !normalizedNotesPath || (
    normalizedPath !== normalizedNotesPathPrefix &&
    !normalizedPath.startsWith(`${normalizedNotesPathPrefix}/`)
  );
}

function collectExternalWorkspaceForVaultClose(): PreservedExternalWorkspace {
  const state = useNotesStore.getState();
  const preservedPathByOriginalPath = new Map<string, string>();
  const addPreservedPath = (path: string | null | undefined) => {
    if (!path) {
      return;
    }

    if (isExternalAbsoluteNotePath(path, state.notesPath)) {
      preservedPathByOriginalPath.set(path, path);
      return;
    }

    const starredEntry = findStarredEntryByPath(
      state.starredEntries,
      'note',
      path,
      state.notesPath,
    );
    const absoluteStarredPath = starredEntry
      ? getStarredEntryAbsolutePath(starredEntry)
      : null;
    if (absoluteStarredPath) {
      preservedPathByOriginalPath.set(path, absoluteStarredPath);
    }
  };

  state.openTabs.forEach((tab) => addPreservedPath(tab.path));
  addPreservedPath(state.currentNote?.path);

  if (preservedPathByOriginalPath.size === 0) {
    return null;
  }

  const currentNote = state.currentNote && preservedPathByOriginalPath.has(state.currentNote.path)
    ? {
        ...state.currentNote,
        path: preservedPathByOriginalPath.get(state.currentNote.path) ?? state.currentNote.path,
      }
    : null;
  const noteMetadataEntries = Object.entries(state.noteMetadata?.notes ?? {})
    .flatMap(([path, metadata]) => {
      const preservedPath = preservedPathByOriginalPath.get(path);
      return preservedPath ? [[preservedPath, metadata] as const] : [];
    });

  return {
    currentNote,
    currentNoteRevision: currentNote ? state.currentNoteRevision : 0,
    isDirty: currentNote ? state.isDirty : false,
    openTabs: state.openTabs.flatMap((tab) => {
      const preservedPath = preservedPathByOriginalPath.get(tab.path);
      return preservedPath ? [{ ...tab, path: preservedPath }] : [];
    }),
    noteContentsCache: new Map(
      [...state.noteContentsCache.entries()].flatMap(([path, cacheEntry]) => {
        const preservedPath = preservedPathByOriginalPath.get(path);
        return preservedPath ? [[preservedPath, cacheEntry] as const] : [];
      }),
    ),
    noteMetadata: noteMetadataEntries.length > 0
      ? { version: 1, notes: Object.fromEntries(noteMetadataEntries) }
      : null,
    displayNames: new Map(
      [...state.displayNames.entries()].flatMap(([path, displayName]) => {
        const preservedPath = preservedPathByOriginalPath.get(path);
        return preservedPath ? [[preservedPath, displayName] as const] : [];
      }),
    ),
  };
}

function resetNotesWorkspaceForVaultTransition(
  notesPath = '',
  options: {
    preserveDrafts?: boolean;
    preserveExternalNotes?: boolean;
    preserveSidebarTree?: boolean;
  } = {},
) {
  const preservedDraftWorkspace = options.preserveDrafts
    ? collectDraftWorkspaceForVaultTransition()
    : null;
  const preservedExternalWorkspace = !preservedDraftWorkspace && options.preserveExternalNotes
    ? collectExternalWorkspaceForVaultClose()
    : null;
  const preservedWorkspace = preservedDraftWorkspace ?? preservedExternalWorkspace;

  useNotesStore.getState().clearAssetUrlCache();
  const currentNotesState = useNotesStore.getState();
  void Promise.resolve(flushPendingDeletedItemsToSystemTrash(currentNotesState.pendingDeletedItems))
    .catch(() => undefined);
  const transitionRootFolder: NotesStore['rootFolder'] = options.preserveSidebarTree
    ? currentNotesState.rootFolder ?? {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        children: [],
        expanded: true,
      }
    : null;
  const transitionRootFolderPath = options.preserveSidebarTree && currentNotesState.rootFolder
    ? currentNotesState.rootFolderPath
    : null;
  useNotesStore.setState({
    currentNote: preservedWorkspace?.currentNote ?? null,
    currentNoteRevision: preservedWorkspace?.currentNoteRevision ?? 0,
    currentNoteDiskRevision: 0,
    isDirty: preservedWorkspace?.isDirty ?? false,
    openTabs: preservedWorkspace?.openTabs ?? [],
    recentlyClosedTabs: [],
    rootFolder: transitionRootFolder,
    rootFolderPath: transitionRootFolderPath,
    notesPath,
    draftNotes: preservedDraftWorkspace?.draftNotes ?? {},
    pendingDraftDiscardPath: preservedDraftWorkspace?.pendingDraftDiscardPath ?? null,
    pendingDeletedItems: [],
    noteMetadata: preservedWorkspace?.noteMetadata ?? null,
    displayNames: preservedExternalWorkspace?.displayNames ?? new Map(),
    noteContentsCache: preservedWorkspace?.noteContentsCache ?? new Map(),
    noteContentsCacheRevision: (currentNotesState.noteContentsCacheRevision ?? 0) + 1,
    isNewlyCreated: false,
    newlyCreatedFolderPath: null,
    assetList: [],
    isLoadingAssets: false,
    uploadProgress: null,
  });
  void flushStalePendingTrashForVault(notesPath).catch(() => undefined);
}

export const useVaultStore = create<VaultStore>()((set, get) => ({
  currentVault: null,
  recentVaults: [],
  isLoading: false,
  hasInitialized: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, hasInitialized: false, error: null });

    try {
      const storage = getStorageAdapter();
      const persistedVaultState = await loadPersistedVaultState();
      const savedVaults = persistedVaultState.recentVaults;
      const currentVaultId = persistedVaultState.currentVaultId;
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
        persistVaultState(recentVaults, currentVaultId);
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
          persistVaultState(recentVaults, currentVault.id);
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
          persistVaultState(recentVaults, null);
        }
      }

      setupBroadcastChannel();

      const runtimeVault = get().currentVault;
      if (runtimeVault) {
        const normalizedRuntimeVault = normalizeVaultInfo(runtimeVault);
        set({
          recentVaults: normalizeRecentVaults([
            ...(normalizedRuntimeVault ? [normalizedRuntimeVault] : []),
            ...get().recentVaults,
            ...recentVaults,
          ]),
          currentVault: normalizedRuntimeVault,
          isLoading: false,
          hasInitialized: true,
        });
        return;
      }

      set({ recentVaults, currentVault, isLoading: false, hasInitialized: true });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize vaults',
        isLoading: false,
        hasInitialized: true,
      });
      throw error;
    }
  },

  checkVaultOpenInOtherWindow: async (path: string): Promise<string | null> => {
    return queryVaultOpenInOtherWindow(path);
  },

  openVault: async (path: string, name?: string, options: { preserveSidebarTree?: boolean } = {}) => {
    set({ isLoading: true, error: null });
    recordDiagnostic('vault.openVault', 'start', {
      path,
      name: name ?? null,
      preserveSidebarTree: options.preserveSidebarTree ?? null,
      currentVaultPath: get().currentVault?.path ?? null,
      recentVaultCount: get().recentVaults.length,
    });

    try {
      const prepared = await prepareNotesForVaultExit({ blockUnsavedDrafts: false });
      if (!prepared.ok) {
        set({ error: prepared.error, isLoading: false });
        recordDiagnostic('vault.openVault', 'prepare_failed', {
          path,
          error: prepared.error,
        });
        return false;
      }

      const storage = getStorageAdapter();
      recordDiagnostic('vault.openVault', 'storage_adapter', {
        path,
        platform: storage.platform,
      });

      if (storage.platform === 'web' && isNativeFilesystemPath(path)) {
        set({ error: 'Invalid path for web platform', isLoading: false });
        recordDiagnostic('vault.openVault', 'reject_web_native_path', { path });
        return false;
      }

      const normalizedPath = normalizeVaultPath(path);
      const pathExists = await storage.exists(normalizedPath);
      recordDiagnostic('vault.openVault', 'path_exists_result', {
        path,
        normalizedPath,
        pathExists,
      });
      if (!pathExists) {
        set({ error: 'Folder does not exist or cannot be accessed', isLoading: false });
        recordDiagnostic('vault.openVault', 'path_missing_or_inaccessible', {
          path,
          normalizedPath,
        });
        return false;
      }

      recordDiagnostic('vault.openVault', 'ensure_config_start', {
        normalizedPath,
      });
      await ensureVaultConfig(normalizedPath);
      recordDiagnostic('vault.openVault', 'ensure_config_complete', {
        normalizedPath,
      });

      const nextVaultState = upsertRecentVault(
        normalizeRecentVaults(get().recentVaults),
        normalizedPath,
        name
      );
      const vault = nextVaultState.vault;
      const updatedRecent = nextVaultState.recentVaults;

      persistVaultState(updatedRecent, vault.id);

      const previousVault = get().currentVault;
      const previousVaultPath = previousVault?.path ? normalizeVaultPath(previousVault.path) : '';
      if (previousVaultPath !== vault.path) {
        recordDiagnostic('vault.openVault', 'reset_notes_workspace', {
          previousVaultPath,
          nextVaultPath: vault.path,
          preserveSidebarTree: options.preserveSidebarTree ?? true,
        });
        resetNotesWorkspaceForVaultTransition(vault.path, {
          preserveDrafts: true,
          preserveSidebarTree: options.preserveSidebarTree ?? true,
        });
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

      recordDiagnostic('vault.openVault', 'success', {
        vaultPath: vault.path,
        vaultId: vault.id,
        recentVaultCount: updatedRecent.length,
      });
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open vault',
        isLoading: false,
      });
      recordDiagnostic('vault.openVault', 'failed', {
        path,
        error,
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

        persistVaultState(nextRecentVaults, nextVault.id);

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

  removeFromRecent: async (id: string) => {
    const { recentVaults, currentVault } = get();
    if (currentVault?.id === id) {
      const prepared = await prepareNotesForVaultExit();
      if (!prepared.ok) {
        set({ error: prepared.error });
        return false;
      }
    }

    removeRecentVaultAction({ id, recentVaults, currentVault, set });
    if (currentVault?.id === id) {
      resetNotesWorkspaceForVaultTransition('', { preserveExternalNotes: true });
    }
    set({ error: null });
    return true;
  },

  closeVault: async () => {
    const prepared = await prepareNotesForVaultExit();
    if (!prepared.ok) {
      set({ error: prepared.error });
      return false;
    }

    closeCurrentVaultAction(set, get().recentVaults);
    resetNotesWorkspaceForVaultTransition('', { preserveExternalNotes: true });
    set({ error: null });
    return true;
  },

  clearError: () => {
    set({ error: null });
  },
}));

let vaultStorageListenerRegistered = false;

function registerVaultStorageListener(): void {
  if (vaultStorageListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== VAULTS_STORAGE_KEY) {
      return;
    }

    if (isOversizedRecentVaultsStorageValue(event.newValue)) {
      return;
    }

    const recentVaults = parseRecentVaultsStorageValue(event.newValue);
    const currentVault = useVaultStore.getState().currentVault;
    const refreshedCurrentVault = currentVault
      ? recentVaults.find((vault) => vault.id === currentVault.id) ?? currentVault
      : null;

    useVaultStore.setState({
      recentVaults,
      currentVault: refreshedCurrentVault,
    });
  });

  vaultStorageListenerRegistered = true;
}

registerVaultStorageListener();
