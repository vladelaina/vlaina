import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getNotesRootSystemStorePath } from '@/stores/notes/systemStoragePaths';
import { flushStarredRegistry } from '@/stores/notes/starred';
import { collectExpandedPaths } from '@/stores/notes/fileTreeUtils';
import type { StarredEntry } from '@/stores/notes/types';
import { getE2ERootFolderReferenceVersion } from './syncE2EBridgeState';
import type { E2EBridge } from './syncE2EBridgeTypes';

type NotesBridgeActions = Pick<
  E2EBridge,
  | 'createNotesFixture'
  | 'createNotesRootFixture'
  | 'createNotesRootFilesFixture'
  | 'initializeNotesRootStore'
  | 'openNotesRoot'
  | 'getNotesRootState'
  | 'removeRecentNotesRoot'
  | 'readNotesRootConfig'
  | 'openAbsoluteNote'
  | 'openAbsoluteNoteWithTiming'
  | 'getNotesState'
  | 'getNotesTreeMetrics'
  | 'getNoteContentCacheEntry'
  | 'pruneNoteContentsCacheToOpenNotes'
  | 'getNotesPreferences'
  | 'getStarredState'
  | 'loadStarred'
  | 'toggleStarred'
  | 'removeStarredEntry'
  | 'updateCurrentNoteContent'
  | 'saveCurrentNote'
  | 'syncCurrentNoteFromDisk'
  | 'applyExternalPathDeletion'
  | 'setGlobalNoteIconSize'
  | 'readTextFile'
  | 'writeTextFile'
>;

export function createSyncE2ENotesActions(): NotesBridgeActions {
  return {
    createNotesFixture: async (input) => {
      const storage = getStorageAdapter();
      const basePath = await storage.getBasePath();
      const fixtureRoot = await joinPath(basePath, 'e2e-notes');
      const notesRootPath = await joinPath(
        fixtureRoot,
        `notes-root-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
      await storage.mkdir(notesRootPath, true);

      const notePath = await joinPath(notesRootPath, input?.filename ?? 'shared.md');
      await storage.writeFile(notePath, input?.content ?? '# Shared\n\nInitial\n', { recursive: true });
      return { notesRootPath, notePath };
    },
    createNotesRootFixture: async (input) => {
      const storage = getStorageAdapter();
      const basePath = await storage.getBasePath();
      const fixtureRoot = await joinPath(basePath, 'e2e-notes-roots');
      const notesRootPath = await joinPath(
        fixtureRoot,
        `${input?.name ?? 'notesRoot'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
      await storage.mkdir(notesRootPath, true);

      const notePath = await joinPath(notesRootPath, input?.filename ?? 'starred.md');
      await storage.writeFile(notePath, input?.content ?? '# Starred\n\nInitial\n', { recursive: true });
      return { notesRootPath, notePath };
    },
    createNotesRootFilesFixture: async (input) => {
      const storage = getStorageAdapter();
      const basePath = await storage.getBasePath();
      const fixtureRoot = await joinPath(basePath, 'e2e-notes-roots');
      const notesRootPath = await joinPath(
        fixtureRoot,
        `${input.name ?? 'notes-root-files'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
      await storage.mkdir(notesRootPath, true);

      const notePaths: string[] = [];
      for (const file of input.files) {
        const notePath = await joinPath(notesRootPath, file.filename);
        await storage.writeFile(notePath, file.content, { recursive: true });
        notePaths.push(notePath);
      }

      return { notesRootPath, notePaths };
    },
    initializeNotesRootStore: async () => {
      await useNotesRootStore.getState().initialize();
    },
    openNotesRoot: async (path, name) => {
      return useNotesRootStore.getState().openNotesRoot(path, name, { preserveSidebarTree: false });
    },
    getNotesRootState: () => {
      const { currentNotesRoot, recentNotesRoots, error, isLoading } = useNotesRootStore.getState();
      return {
        currentNotesRoot: currentNotesRoot ? { ...currentNotesRoot } : null,
        recentNotesRoots: recentNotesRoots.map((notesRoot) => ({ ...notesRoot })),
        error,
        isLoading,
      };
    },
    removeRecentNotesRoot: async (id) => {
      return useNotesRootStore.getState().removeFromRecent(id);
    },
    readNotesRootConfig: async (path) => {
      const configPath = await getNotesRootSystemStorePath(path, 'config.json');
      return JSON.parse(await getStorageAdapter().readFile(configPath));
    },
    openAbsoluteNote: async (path) => {
      await useNotesStore.getState().openNoteByAbsolutePath(path, true);
    },
    openAbsoluteNoteWithTiming: async (path) => {
      const startedAt = performance.now();
      await useNotesStore.getState().openNoteByAbsolutePath(path, true);
      const state = useNotesStore.getState();
      return {
        totalMs: performance.now() - startedAt,
        currentNoteContentLength: state.currentNote?.content.length ?? 0,
        currentNotePath: state.currentNote?.path ?? null,
      };
    },
    getNotesState: () => {
      const { currentNote, isDirty, error, openTabs } = useNotesStore.getState();
      return {
        currentNote: currentNote ? { ...currentNote } : null,
        isDirty,
        error,
        openTabs: openTabs.map((tab) => ({ ...tab })),
      };
    },
    getNotesTreeMetrics: () => {
      const { rootFolder, rootFolderPath, noteMetadata, isLoading } = useNotesStore.getState();
      const stack = [...(rootFolder?.children ?? [])];
      let folders = 0;
      let files = 0;
      while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node.isFolder) {
          folders += 1;
          stack.push(...node.children);
        } else {
          files += 1;
        }
      }
      return {
        folders,
        files,
        metadataEntries: Object.keys(noteMetadata?.notes ?? {}).length,
        expandedFolders: rootFolder ? Array.from(collectExpandedPaths(rootFolder.children)) : [],
        isLoading,
        rootFolderPath,
        rootFolderReferenceVersion: getE2ERootFolderReferenceVersion(rootFolder),
      };
    },
    getNoteContentCacheEntry: (path) => {
      const { currentNote, noteContentsCache, openTabs } = useNotesStore.getState();
      const entry = noteContentsCache.get(path);
      return {
        hasEntry: Boolean(entry),
        contentLength: entry?.content.length ?? 0,
        contentPreview: entry?.content.slice(0, 200) ?? '',
        freshUntil: entry?.freshUntil ?? null,
        modifiedAt: entry?.modifiedAt ?? null,
        currentNotePath: currentNote?.path ?? null,
        openTabPaths: openTabs.map((tab) => tab.path),
        cacheKeys: Array.from(noteContentsCache.keys()),
      };
    },
    pruneNoteContentsCacheToOpenNotes: () => {
      const store = useNotesStore.getState();
      store.cancelNoteContentScan();
      store.pruneNoteContentsCacheToOpenNotes();
    },
    getNotesPreferences: () => {
      const { noteIconSize, recentNotes } = useNotesStore.getState();
      return { noteIconSize, recentNotes: [...recentNotes] };
    },
    getStarredState: () => {
      const { notesPath, starredEntries, starredNotes, starredFolders, starredLoaded } = useNotesStore.getState();
      return {
        notesPath,
        starredEntries: starredEntries.map((entry: StarredEntry) => ({ ...entry })),
        starredNotes: [...starredNotes],
        starredFolders: [...starredFolders],
        starredLoaded,
      };
    },
    loadStarred: async (notesRootPath) => {
      await useNotesStore.getState().loadStarred(notesRootPath);
    },
    toggleStarred: async (path) => {
      useNotesStore.getState().toggleStarred(path);
      await flushStarredRegistry();
    },
    removeStarredEntry: async (id) => {
      useNotesStore.getState().removeStarredEntry(id);
      await flushStarredRegistry();
    },
    updateCurrentNoteContent: async (content) => {
      useNotesStore.getState().updateContent(content);
    },
    saveCurrentNote: async () => {
      await useNotesStore.getState().saveNote({ explicit: true });
    },
    syncCurrentNoteFromDisk: async (options) => {
      return useNotesStore.getState().syncCurrentNoteFromDisk(options);
    },
    applyExternalPathDeletion: async (path) => {
      await useNotesStore.getState().applyExternalPathDeletion(path);
    },
    setGlobalNoteIconSize: async (size) => {
      useNotesStore.getState().setGlobalIconSize(size);
    },
    readTextFile: async (path) => {
      return getStorageAdapter().readFile(path);
    },
    writeTextFile: async (path, content) => {
      await getStorageAdapter().writeFile(path, content, { recursive: true });
    },
  };
}
