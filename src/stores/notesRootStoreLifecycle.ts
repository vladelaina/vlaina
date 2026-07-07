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
  return {
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
  };
}
