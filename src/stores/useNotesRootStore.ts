import { create } from 'zustand';
import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import {
  findStarredEntryByPath,
  getStarredEntryAbsolutePath,
  normalizeStarredNotesRootPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { moveNotesRootSystemStore } from '@/stores/notes/systemStoragePaths';
import {
  flushPendingDeletedItemsToSystemTrash,
  flushStalePendingTrashForNotesRoot,
} from '@/stores/notes/utils/fs/trashOperations';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { suspendExternalSync } from '@/stores/notes/document/externalSyncControl';
import { saveAutoSaveableDrafts } from '@/stores/notes/autoSaveableDrafts';
import { saveDirtyRegularOpenTabs } from '@/stores/notes/dirtyOpenTabs';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import type { MetadataFile, NotesStore } from '@/stores/notes/types';
import { setCurrentNotesRootPath, useNotesStore } from './useNotesStore';
import { ensureNotesRootConfig, normalizeNotesRootPath } from './notesRootConfig';
import {
  NOTES_ROOTS_STORAGE_KEY,
  initializeWindowLabel,
  isNativeFilesystemPath,
  loadPersistedNotesRootState,
  normalizeRecentNotesRoots,
  normalizeNotesRootInfo,
  isOversizedRecentNotesRootsStorageValue,
  parseRecentNotesRootsStorageValue,
  persistNotesRootState,
  queryNotesRootOpenInOtherWindow,
  closeCurrentNotesRootAction,
  removeRecentNotesRootAction,
  resolveRenamedNotesRootPath,
  setWindowNotesRootPath,
  setupBroadcastChannel,
  syncCurrentNotesRootExternalPathAction,
  upsertRecentNotesRoot,
  waitForUiRelease,
} from './notesRootStoreSupport';

export interface NotesRootInfo {
  id: string;
  name: string;
  path: string;
  lastOpened: number;
}

interface NotesRootState {
  currentNotesRoot: NotesRootInfo | null;
  recentNotesRoots: NotesRootInfo[];
  isLoading: boolean;
  hasInitialized: boolean;
  error: string | null;
}

interface NotesRootActions {
  initialize: () => Promise<void>;
  openNotesRoot: (path: string, name?: string, options?: { preserveSidebarTree?: boolean }) => Promise<boolean>;
  createNotesRoot: (name: string, path: string) => Promise<boolean>;
  renameCurrentNotesRoot: (name: string) => Promise<boolean>;
  syncCurrentNotesRootExternalPath: (path: string) => void;
  removeFromRecent: (id: string) => Promise<boolean>;
  closeNotesRoot: () => Promise<boolean>;
  clearError: () => void;
  checkNotesRootOpenInOtherWindow: (path: string) => Promise<string | null>;
}

type NotesRootStore = NotesRootState & NotesRootActions;

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

async function prepareNotesForNotesRootExit(
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
    return { ok: false, error: 'Save or discard draft notes before opening another folder' };
  }

  return { ok: true };
}

function collectDraftWorkspaceForNotesRootTransition(): PreservedDraftWorkspace {
  const state = useNotesStore.getState();
  const candidateDraftPaths = new Set(Object.keys(state.draftNotes));
  state.openTabs.forEach((tab) => {
    if (isDraftNotePath(tab.path)) candidateDraftPaths.add(tab.path);
  });
  if (isDraftNotePath(state.currentNote?.path)) {
    candidateDraftPaths.add(state.currentNote.path);
  }

  const draftPaths = new Set<string>();
  candidateDraftPaths.forEach((draftPath) => {
    const draftEntry = state.draftNotes[draftPath];
    const draftContent = state.currentNote?.path === draftPath
      ? state.currentNote.content
      : state.noteContentsCache.get(draftPath)?.content ?? '';
    const draftMetadata = state.noteMetadata?.notes[draftPath];

    if (hasDraftUnsavedChanges({
      draftName: draftEntry?.name,
      content: draftContent,
      metadata: draftMetadata,
    })) {
      draftPaths.add(draftPath);
    }
  });

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

  const normalizedPath = normalizeNotesRootPath(path);
  const normalizedNotesPath = normalizeNotesRootPath(notesPath);
  if (normalizedNotesPath === '/') {
    return false;
  }

  const normalizedNotesPathPrefix = normalizedNotesPath.replace(/\/+$/, '');
  return !normalizedNotesPath || (
    normalizedPath !== normalizedNotesPathPrefix &&
    !normalizedPath.startsWith(`${normalizedNotesPathPrefix}/`)
  );
}

function collectExternalWorkspaceForNotesRootClose(): PreservedExternalWorkspace {
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

function resetNotesWorkspaceForNotesRootTransition(
  notesPath = '',
  options: {
    preserveDrafts?: boolean;
    preserveExternalNotes?: boolean;
    preserveSidebarTree?: boolean;
  } = {},
) {
  const preservedDraftWorkspace = options.preserveDrafts
    ? collectDraftWorkspaceForNotesRootTransition()
    : null;
  const preservedExternalWorkspace = !preservedDraftWorkspace && options.preserveExternalNotes
    ? collectExternalWorkspaceForNotesRootClose()
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
    noteNavigationHistory: [],
    noteNavigationHistoryIndex: -1,
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
  void flushStalePendingTrashForNotesRoot(notesPath).catch(() => undefined);
}

export const useNotesRootStore = create<NotesRootStore>()((set, get) => ({
  currentNotesRoot: null,
  recentNotesRoots: [],
  isLoading: false,
  hasInitialized: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true, hasInitialized: false, error: null });

    try {
      const storage = getStorageAdapter();
      const persistedNotesRootState = await loadPersistedNotesRootState();
      const savedNotesRoots = persistedNotesRootState.recentNotesRoots;
      const currentNotesRootId = persistedNotesRootState.currentNotesRootId;
      const isWebPlatform = storage.platform === 'web';
      const launchContext = readWindowLaunchContext();
      const requestedNotesRootPath = launchContext.notesRootPath
        ? normalizeNotesRootPath(launchContext.notesRootPath)
        : null;

      await initializeWindowLabel();

      const existChecks = await Promise.all(
        savedNotesRoots.map(async (notesRoot) => {
          if (isWebPlatform && isNativeFilesystemPath(notesRoot.path)) {
            return { notesRoot, exists: false };
          }
          return { notesRoot, exists: await storage.exists(notesRoot.path) };
        })
      );
      let recentNotesRoots = normalizeRecentNotesRoots(
        existChecks.filter((candidate) => candidate.exists).map((candidate) => candidate.notesRoot)
      );

      if (recentNotesRoots.length !== savedNotesRoots.length) {
        persistNotesRootState(recentNotesRoots, currentNotesRootId);
      }

      let currentNotesRoot: NotesRootInfo | null = null;
      if (requestedNotesRootPath) {
        const requestedNotesRootExists =
          !isWebPlatform || !isNativeFilesystemPath(requestedNotesRootPath)
            ? await storage.exists(requestedNotesRootPath)
            : false;

        if (requestedNotesRootExists) {
          await ensureNotesRootConfig(requestedNotesRootPath);
          const nextNotesRootState = upsertRecentNotesRoot(recentNotesRoots, requestedNotesRootPath);
          recentNotesRoots = nextNotesRootState.recentNotesRoots;
          currentNotesRoot = nextNotesRootState.notesRoot;
          persistNotesRootState(recentNotesRoots, currentNotesRoot.id, {
            restoredNotesRoots: [currentNotesRoot],
          });
          setWindowNotesRootPath(currentNotesRoot.path);
          setCurrentNotesRootPath(currentNotesRoot.path);
        }
      } else if (currentNotesRootId && !launchContext.isNewWindow) {
        currentNotesRoot = recentNotesRoots.find((notesRoot) => notesRoot.id === currentNotesRootId) || null;
        if (currentNotesRoot) {
          await ensureNotesRootConfig(currentNotesRoot.path);
          setWindowNotesRootPath(currentNotesRoot.path);
          setCurrentNotesRootPath(currentNotesRoot.path);
        } else {
          persistNotesRootState(recentNotesRoots, null);
        }
      }

      setupBroadcastChannel();

      const runtimeNotesRoot = get().currentNotesRoot;
      if (runtimeNotesRoot) {
        const normalizedRuntimeNotesRoot = normalizeNotesRootInfo(runtimeNotesRoot);
        set({
          recentNotesRoots: normalizeRecentNotesRoots([
            ...(normalizedRuntimeNotesRoot ? [normalizedRuntimeNotesRoot] : []),
            ...get().recentNotesRoots,
            ...recentNotesRoots,
          ]),
          currentNotesRoot: normalizedRuntimeNotesRoot,
          isLoading: false,
          hasInitialized: true,
        });
        return;
      }

      set({ recentNotesRoots, currentNotesRoot, isLoading: false, hasInitialized: true });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize opened folders',
        isLoading: false,
        hasInitialized: true,
      });
      throw error;
    }
  },

  checkNotesRootOpenInOtherWindow: async (path: string): Promise<string | null> => {
    return queryNotesRootOpenInOtherWindow(path);
  },

  openNotesRoot: async (path: string, name?: string, options: { preserveSidebarTree?: boolean } = {}) => {
    set({ isLoading: true, error: null });

    try {
      const prepared = await prepareNotesForNotesRootExit({ blockUnsavedDrafts: false });
      if (!prepared.ok) {
        set({ error: prepared.error, isLoading: false });
        return false;
      }

      const storage = getStorageAdapter();

      if (storage.platform === 'web' && isNativeFilesystemPath(path)) {
        set({ error: 'Invalid path for web platform', isLoading: false });
        return false;
      }

      const normalizedPath = normalizeNotesRootPath(path);
      const pathExists = await storage.exists(normalizedPath);
      if (!pathExists) {
        set({ error: 'Folder does not exist or cannot be accessed', isLoading: false });
        return false;
      }

      await ensureNotesRootConfig(normalizedPath);

      const nextNotesRootState = upsertRecentNotesRoot(
        normalizeRecentNotesRoots(get().recentNotesRoots),
        normalizedPath,
        name
      );
      const notesRoot = nextNotesRootState.notesRoot;
      const updatedRecent = nextNotesRootState.recentNotesRoots;

      persistNotesRootState(updatedRecent, notesRoot.id, {
        restoredNotesRoots: [notesRoot],
      });

      const previousNotesRoot = get().currentNotesRoot;
      const previousNotesRootPath = previousNotesRoot?.path ? normalizeNotesRootPath(previousNotesRoot.path) : '';
      if (previousNotesRootPath !== notesRoot.path) {
        resetNotesWorkspaceForNotesRootTransition(notesRoot.path, {
          preserveDrafts: true,
          preserveSidebarTree: options.preserveSidebarTree ?? true,
        });
      }

      set({
        currentNotesRoot: notesRoot,
        recentNotesRoots: updatedRecent,
        isLoading: false,
      });

      setWindowNotesRootPath(notesRoot.path);
      setCurrentNotesRootPath(notesRoot.path);
      if (previousNotesRootPath === notesRoot.path) {
        useNotesStore.setState({ notesPath: notesRoot.path });
      }

      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to open folder',
        isLoading: false,
      });
      return false;
    }
  },

  createNotesRoot: async (name: string, path: string) => {
    set({ isLoading: true, error: null });

    try {
      const prepared = await prepareNotesForNotesRootExit();
      if (!prepared.ok) {
        set({ error: prepared.error, isLoading: false });
        return false;
      }

      const storage = getStorageAdapter();
      const normalizedPath = normalizeNotesRootPath(path);
      const pathExists = await storage.exists(normalizedPath);
      if (!pathExists) {
        await storage.mkdir(normalizedPath, true);
      }

      await ensureNotesRootConfig(normalizedPath);

      return await get().openNotesRoot(normalizedPath, name);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create folder',
        isLoading: false,
      });
      return false;
    }
  },

  renameCurrentNotesRoot: async (name: string) => {
    const { currentNotesRoot, recentNotesRoots } = get();
    if (!currentNotesRoot) {
      return false;
    }

    try {
      const storage = getStorageAdapter();
      const notesState = useNotesStore.getState();
      const normalizedCurrentNotesRoot = normalizeNotesRootInfo(currentNotesRoot);
      const normalizedRecentNotesRoots = normalizeRecentNotesRoots(recentNotesRoots);
      const trimmedName = name.trim();
      if (!trimmedName) {
        return false;
      }

      const prepared = await prepareNotesForNotesRootExit();
      if (!prepared.ok) {
        set({ error: prepared.error });
        return false;
      }

      const { name: nextName, path: nextPath } = await resolveRenamedNotesRootPath(
        normalizedCurrentNotesRoot.path,
        trimmedName
      );

      if (nextPath === normalizedCurrentNotesRoot.path && nextName === normalizedCurrentNotesRoot.name) {
        return true;
      }

      const resumeExternalSync = await suspendExternalSync();
      const previousNotesRoot = normalizedCurrentNotesRoot;

      try {
        set({ currentNotesRoot: null });
        resetNotesWorkspaceForNotesRootTransition();
        await waitForUiRelease();

        markExpectedExternalChange(normalizedCurrentNotesRoot.path, true);
        markExpectedExternalChange(nextPath, true);
        await storage.rename(normalizedCurrentNotesRoot.path, nextPath);
        await moveNotesRootSystemStore(normalizedCurrentNotesRoot.path, nextPath);

        const nextNotesRoot = normalizeNotesRootInfo({
          ...normalizedCurrentNotesRoot,
          name: nextName,
          path: nextPath,
          lastOpened: Date.now(),
        });
        const nextRecentNotesRoots = normalizeRecentNotesRoots([
          nextNotesRoot,
          ...normalizedRecentNotesRoots.filter(
            (notesRoot) => notesRoot.id !== normalizedCurrentNotesRoot.id && notesRoot.path !== nextPath
          ),
        ]);

        persistNotesRootState(nextRecentNotesRoots, nextNotesRoot.id, {
          restoredNotesRoots: [nextNotesRoot],
        });

        const normalizedCurrentNotesRootPath = normalizeStarredNotesRootPath(normalizedCurrentNotesRoot.path);
        const nextStarredEntries = notesState.starredEntries.map((entry) =>
          normalizeStarredNotesRootPath(entry.notesRootPath) === normalizedCurrentNotesRootPath
            ? { ...entry, notesRootPath: nextPath }
            : entry
        );
        useNotesStore.setState({
          starredEntries: nextStarredEntries,
        });
        saveStarredRegistry(nextStarredEntries);
        setWindowNotesRootPath(nextPath);
        setCurrentNotesRootPath(nextPath);
        set({
          currentNotesRoot: nextNotesRoot,
          recentNotesRoots: nextRecentNotesRoots,
          error: null,
        });

        const reopened = await get().openNotesRoot(nextPath, nextName);
        if (!reopened) {
          throw new Error('NotesRoot rename succeeded but reopening the renamed notesRoot failed');
        }

        return true;
      } catch (error) {
        await get().openNotesRoot(previousNotesRoot.path, previousNotesRoot.name);
        throw error;
      } finally {
        resumeExternalSync();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
      return false;
    }
  },

  syncCurrentNotesRootExternalPath: (path: string) => {
    const { currentNotesRoot, recentNotesRoots } = get();
    syncCurrentNotesRootExternalPathAction({ path, currentNotesRoot, recentNotesRoots, set });
  },

  removeFromRecent: async (id: string) => {
    const { recentNotesRoots, currentNotesRoot } = get();
    if (currentNotesRoot?.id === id) {
      const prepared = await prepareNotesForNotesRootExit();
      if (!prepared.ok) {
        set({ error: prepared.error });
        return false;
      }
    }

    removeRecentNotesRootAction({ id, recentNotesRoots, currentNotesRoot, set });
    if (currentNotesRoot?.id === id) {
      resetNotesWorkspaceForNotesRootTransition('', { preserveExternalNotes: true });
    }
    set({ error: null });
    return true;
  },

  closeNotesRoot: async () => {
    const prepared = await prepareNotesForNotesRootExit();
    if (!prepared.ok) {
      set({ error: prepared.error });
      return false;
    }

    closeCurrentNotesRootAction(set, get().recentNotesRoots);
    resetNotesWorkspaceForNotesRootTransition('', { preserveExternalNotes: true });
    set({ error: null });
    return true;
  },

  clearError: () => {
    set({ error: null });
  },
}));

let notesRootStorageListenerRegistered = false;

function registerNotesRootStorageListener(): void {
  if (notesRootStorageListenerRegistered || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== NOTES_ROOTS_STORAGE_KEY) {
      return;
    }

    if (isOversizedRecentNotesRootsStorageValue(event.newValue)) {
      return;
    }

    const recentNotesRoots = parseRecentNotesRootsStorageValue(event.newValue);
    const currentNotesRoot = useNotesRootStore.getState().currentNotesRoot;
    const refreshedCurrentNotesRoot = currentNotesRoot
      ? recentNotesRoots.find((notesRoot) => notesRoot.id === currentNotesRoot.id) ?? currentNotesRoot
      : null;

    useNotesRootStore.setState({
      recentNotesRoots,
      currentNotesRoot: refreshedCurrentNotesRoot,
    });
  });

  notesRootStorageListenerRegistered = true;
}

registerNotesRootStorageListener();
