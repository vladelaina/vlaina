import { getStorageAdapter } from '@/lib/storage/adapter';
import { markExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { suspendExternalSync } from '@/stores/notes/document/externalSyncControl';
import {
  normalizeStarredNotesRootPath,
  saveStarredRegistry,
} from '@/stores/notes/starred';
import { moveNotesRootSystemStore } from '@/stores/notes/systemStoragePaths';
import { setCurrentNotesRootPath, useNotesStore } from './useNotesStore';
import { ensureNotesRootConfig, normalizeNotesRootPath } from './notesRootConfig';
import { prepareNotesForNotesRootExit } from './notesRootExitGuards';
import { resetNotesWorkspaceForNotesRootTransition } from './notesRootWorkspaceTransition';
import {
  closeCurrentNotesRootAction,
  isNativeFilesystemPath,
  normalizeNotesRootInfo,
  normalizeRecentNotesRoots,
  persistNotesRootState,
  removeRecentNotesRootAction,
  resolveRenamedNotesRootPath,
  setWindowNotesRootPath,
  syncCurrentNotesRootExternalPathAction,
  upsertRecentNotesRoot,
  waitForUiRelease,
} from './notesRootStoreSupport';
import type { NotesRootActions, NotesRootStoreGet, NotesRootStoreSet } from './notesRootStoreTypes';

export function createNotesRootMutationActions(
  set: NotesRootStoreSet,
  get: NotesRootStoreGet,
): Omit<NotesRootActions, 'initialize' | 'checkNotesRootOpenInOtherWindow'> {
  return {
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
  };
}
