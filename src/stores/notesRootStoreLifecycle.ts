import { getStorageAdapter } from '@/lib/storage/adapter';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { setCurrentNotesRootPath } from './useNotesStore';
import { ensureNotesRootConfig, normalizeNotesRootPath } from './notesRootConfig';
import {
  initializeWindowLabel,
  isNativeFilesystemPath,
  loadPersistedNotesRootState,
  normalizeRecentNotesRoots,
  normalizeNotesRootInfo,
  persistNotesRootState,
  queryNotesRootOpenInOtherWindow,
  setWindowNotesRootPath,
  setupBroadcastChannel,
  upsertRecentNotesRoot,
} from './notesRootStoreSupport';
import type { NotesRootActions, NotesRootInfo, NotesRootStoreGet, NotesRootStoreSet } from './notesRootStoreTypes';

export function createNotesRootLifecycleActions(
  set: NotesRootStoreSet,
  get: NotesRootStoreGet,
): Pick<NotesRootActions, 'initialize' | 'checkNotesRootOpenInOtherWindow'> {
  let initializationPromise: Promise<void> | null = null;

  const initialize = async () => {
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

      let recentNotesRoots = normalizeRecentNotesRoots(savedNotesRoots);
      set({ recentNotesRoots });
      let currentNotesRoot: NotesRootInfo | null = null;
      if (requestedNotesRootPath) {
        const requestedNotesRootExists =
          !isWebPlatform || !isNativeFilesystemPath(requestedNotesRootPath)
            ? await storage.exists(requestedNotesRootPath).catch(() => false)
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
        const savedCurrentNotesRoot = recentNotesRoots.find(
          (notesRoot) => notesRoot.id === currentNotesRootId,
        ) || null;
        const savedCurrentNotesRootExists = savedCurrentNotesRoot && (
          !isWebPlatform || !isNativeFilesystemPath(savedCurrentNotesRoot.path)
            ? await storage.exists(savedCurrentNotesRoot.path).catch(() => false)
            : false
        );

        if (savedCurrentNotesRootExists && savedCurrentNotesRoot) {
          currentNotesRoot = savedCurrentNotesRoot;
          await ensureNotesRootConfig(currentNotesRoot.path);
          setWindowNotesRootPath(currentNotesRoot.path);
          setCurrentNotesRootPath(currentNotesRoot.path);
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
  };

  return {
    initialize: () => {
      if (initializationPromise) {
        return initializationPromise;
      }

      const promise = initialize();
      initializationPromise = promise;
      const clearInitializationPromise = () => {
        if (initializationPromise === promise) {
          initializationPromise = null;
        }
      };
      void promise.then(clearInitializationPromise, clearInitializationPromise);
      return promise;
    },

    checkNotesRootOpenInOtherWindow: async (path: string): Promise<string | null> => {
      return queryNotesRootOpenInOtherWindow(path);
    },
  };
}
