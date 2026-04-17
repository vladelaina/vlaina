import { StateCreator } from 'zustand';
import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore } from '../types';
import { updateDisplayName } from '../displayNameUtils';
import {
  addToRecentNotes,
  createEmptyMetadataFile,
  persistRecentNotes,
  setNoteEntry,
} from '../storage';
import {
  collectExpandedPaths,
  findNode,
  removeNodeFromTree,
  updateFileNodePath,
  updateFolderNode,
} from '../fileTreeUtils';
import {
  getVaultStarredPaths,
  remapStarredEntriesForVault,
  saveStarredRegistry,
} from '../starred';
import { openStoredNotePath } from '../openNotePath';
import {
  getCachedNoteModifiedAt,
  pruneCachedNoteContents,
  remapCachedNoteContents,
  removeCachedNoteContent,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { loadNoteDocument, saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import {
  pruneDisplayNamesForExternalDeletion,
  pruneExpandedFoldersForExternalDeletion,
  pruneOpenTabsForExternalDeletion,
  pruneRecentNotesForExternalDeletion,
  remapCurrentNoteForExternalRename,
  remapDisplayNamesForExternalRename,
  remapExpandedFoldersForExternalRename,
  remapOpenTabsForExternalRename,
  remapRecentNotesForExternalRename,
  shouldPreserveDeletedCurrentNote,
} from '../document/externalPathSync';
import { remapMetadataEntries } from '../storage';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { readNoteMetadataFromMarkdown } from '../frontmatter';

export interface WorkspaceSlice {
  currentNote: NotesStore['currentNote'];
  isDirty: NotesStore['isDirty'];
  isLoading: NotesStore['isLoading'];
  error: NotesStore['error'];
  openTabs: NotesStore['openTabs'];
  displayNames: NotesStore['displayNames'];

  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string, openInNewTab?: boolean) => Promise<void>;
  saveNote: () => Promise<void>;
  syncCurrentNoteFromDisk: NotesStore['syncCurrentNoteFromDisk'];
  invalidateNoteCache: NotesStore['invalidateNoteCache'];
  applyExternalPathRename: NotesStore['applyExternalPathRename'];
  applyExternalPathDeletion: NotesStore['applyExternalPathDeletion'];
  updateContent: (content: string) => void;
  closeNote: () => void;
  closeTab: (path: string) => Promise<void>;
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
}

export const createWorkspaceSlice: StateCreator<NotesStore, [], [], WorkspaceSlice> = (
  set,
  get
) => ({
  currentNote: null,
  isDirty: false,
  isLoading: false,
  error: null,
  openTabs: [],
  displayNames: new Map(),

  openNote: async (path: string, openInNewTab: boolean = false) => {
    let { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote, noteContentsCache } = get();
    if (isDirty) {
      await saveNote();
      if (get().isDirty) return;
      ({ notesPath, recentNotes, openTabs, currentNote, noteContentsCache } = get());
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: noteContentsCache,
      });
      const nextMetadata = setNoteEntry(
        get().noteMetadata ?? createEmptyMetadataFile(),
        path,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(path);
      const tabName = fileName;
      const updatedRecent = addToRecentNotes(path, recentNotes);
      const existingTab = openTabs.find((t) => t.path === path);

      let updatedTabs = openTabs;
      if (existingTab) {
        updatedTabs = openTabs.map((t) => (t.path === path ? { ...t, name: tabName } : t));
      } else if (openInNewTab || openTabs.length === 0) {
        updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
      } else {
        const currentTabIndex = openTabs.findIndex((t) => t.path === currentNote?.path);
        if (currentTabIndex !== -1) {
          updatedTabs = [...openTabs];
          updatedTabs[currentTabIndex] = { path, name: tabName, isDirty: false };
        } else {
          updatedTabs = [...openTabs, { path, name: tabName, isDirty: false }];
        }
      }

      updateDisplayName(set, path, tabName);
      set({
        currentNote: { path, content },
        isDirty: false,
        error: null,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: nextCache,
        noteMetadata: nextMetadata,
      });

      const { rootFolder, fileTreeSortMode } = get();
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: path,
        fileTreeSortMode,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    let { notesPath, isDirty, saveNote, openTabs, currentNote, noteContentsCache } = get();
    if (isDirty) {
      await saveNote();
      if (get().isDirty) return;
      ({ notesPath, openTabs, currentNote, noteContentsCache } = get());
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path: absolutePath,
        cache: noteContentsCache,
      });
      const nextMetadata = setNoteEntry(
        get().noteMetadata ?? createEmptyMetadataFile(),
        absolutePath,
        readNoteMetadataFromMarkdown(content)
      );
      const fileName = getNoteTitleFromPath(absolutePath);
      const tabName = fileName;
      const existingTab = openTabs.find((t) => t.path === absolutePath);

      let updatedTabs = openTabs;
      if (existingTab) {
        updatedTabs = openTabs.map((t) => (t.path === absolutePath ? { ...t, name: tabName } : t));
      } else if (openInNewTab || openTabs.length === 0) {
        updatedTabs = [...openTabs, { path: absolutePath, name: tabName, isDirty: false }];
      } else {
        const currentTabIndex = openTabs.findIndex((t) => t.path === currentNote?.path);
        if (currentTabIndex !== -1) {
          updatedTabs = [...openTabs];
          updatedTabs[currentTabIndex] = { path: absolutePath, name: tabName, isDirty: false };
        } else {
          updatedTabs = [...openTabs, { path: absolutePath, name: tabName, isDirty: false }];
        }
      }

      updateDisplayName(set, absolutePath, tabName);
      set({
        currentNote: { path: absolutePath, content },
        isDirty: false,
        error: null,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: nextCache,
        noteMetadata: nextMetadata,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  saveNote: async () => {
    const { currentNote, notesPath, noteContentsCache, noteMetadata, rootFolder, fileTreeSortMode } = get();
    if (!currentNote) return;

    try {
      const { content, metadata, nextCache } = await saveNoteDocument({
        notesPath,
        currentNote,
        cache: noteContentsCache,
      });
      const nextMetadata = setNoteEntry(
        noteMetadata ?? createEmptyMetadataFile(),
        currentNote.path,
        metadata
      );
      const nextRootFolder = buildSortedRootFolder(rootFolder, rootFolder?.children ?? [], fileTreeSortMode, nextMetadata);

      set({
        currentNote: { path: currentNote.path, content },
        isDirty: false,
        noteMetadata: nextMetadata,
        rootFolder: nextRootFolder,
        noteContentsCache: nextCache,
        openTabs: setNoteTabDirtyState(get().openTabs, currentNote.path, false),
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save note' });
    }
  },

  syncCurrentNoteFromDisk: async () => {
    const { currentNote, notesPath, isDirty, noteContentsCache, openTabs, noteMetadata, rootFolder, fileTreeSortMode } = get();
    if (!currentNote) {
      return 'ignored';
    }

    try {
      const storage = getStorageAdapter();
      const fullPath = isAbsolutePath(currentNote.path)
        ? currentNote.path
        : await joinPath(notesPath, currentNote.path);
      const exists = await storage.exists(fullPath);
      const fileInfo = await storage.stat(fullPath);
      const cachedModifiedAt = getCachedNoteModifiedAt(noteContentsCache, currentNote.path);

      if (!exists || fileInfo?.isFile === false) {
        if (isDirty) {
          set({ error: 'Current note was deleted outside vlaina while you still have unsaved changes.' });
          return 'deleted-conflict';
        }

        const updatedTabs = openTabs.filter((tab) => tab.path !== currentNote.path);
        set({
          currentNote: null,
          isDirty: false,
          openTabs: updatedTabs,
          noteContentsCache: removeCachedNoteContent(noteContentsCache, currentNote.path),
          error: null,
        });

        if (updatedTabs.length > 0) {
          const lastTab = updatedTabs[updatedTabs.length - 1];
          if (lastTab) {
            void openStoredNotePath(lastTab.path, {
              openNote: get().openNote,
              openNoteByAbsolutePath: get().openNoteByAbsolutePath,
            });
          }
        }

        return 'deleted';
      }

      const nextModifiedAt = fileInfo?.modifiedAt ?? cachedModifiedAt ?? null;
      if (nextModifiedAt === cachedModifiedAt) {
        return 'unchanged';
      }

      if (isDirty) {
        set({ error: 'Current note changed outside vlaina while you still have unsaved changes.' });
        return 'conflict';
      }

      const nextContent = await storage.readFile(fullPath);
      const nextMetadata = setNoteEntry(
        noteMetadata ?? createEmptyMetadataFile(),
        currentNote.path,
        readNoteMetadataFromMarkdown(nextContent)
      );
      const nextRootFolder = buildSortedRootFolder(rootFolder, rootFolder?.children ?? [], fileTreeSortMode, nextMetadata);
      set({
        currentNote: { path: currentNote.path, content: nextContent },
        isDirty: false,
        openTabs: setNoteTabDirtyState(openTabs, currentNote.path, false),
        noteMetadata: nextMetadata,
        rootFolder: nextRootFolder,
        noteContentsCache: setCachedNoteContent(
          noteContentsCache,
          currentNote.path,
          nextContent,
          nextModifiedAt
        ),
        error: null,
      });

      return 'reloaded';
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to sync note from disk' });
      return 'ignored';
    }
  },

  invalidateNoteCache: (path: string) => {
    const { currentNote, noteContentsCache } = get();
    if (currentNote?.path === path) {
      return;
    }

    set({ noteContentsCache: removeCachedNoteContent(noteContentsCache, path) });
  },

  applyExternalPathRename: async (oldPath: string, newPath: string) => {
    const {
      currentNote,
      openTabs,
      displayNames,
      noteContentsCache,
      noteMetadata,
      starredEntries,
      notesPath,
      recentNotes,
      rootFolder,
      fileTreeSortMode,
    } = get();

    const nextCurrentNote = remapCurrentNoteForExternalRename(currentNote, oldPath, newPath);
    const nextOpenTabs = remapOpenTabsForExternalRename(openTabs, oldPath, newPath);
    const nextDisplayNames = remapDisplayNamesForExternalRename(displayNames, oldPath, newPath);
    const nextRecentNotes = remapRecentNotesForExternalRename(recentNotes, oldPath, newPath);
    const nextCache = remapCachedNoteContents(noteContentsCache, (path) => {
      if (path === oldPath) {
        return newPath;
      }
      if (path.startsWith(`${oldPath}/`)) {
        return `${newPath}${path.slice(oldPath.length)}`;
      }
      return path;
    });

    const nextMetadata = remapMetadataEntries(noteMetadata, (path) => {
      if (path === oldPath) {
        return newPath;
      }
      if (path.startsWith(`${oldPath}/`)) {
        return `${newPath}${path.slice(oldPath.length)}`;
      }
      return path;
    });

    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
      if (relativePath === oldPath) {
        return newPath;
      }
      if (relativePath.startsWith(`${oldPath}/`)) {
        return `${newPath}${relativePath.slice(oldPath.length)}`;
      }
      return relativePath;
    });

    if (starredResult.changed) {
      void saveStarredRegistry(starredResult.entries);
    }
    if (nextRecentNotes !== recentNotes) {
      persistRecentNotes(nextRecentNotes);
    }

    const renamedNode = rootFolder ? findNode(rootFolder.children, oldPath) : null;
    const nextRootFolder = rootFolder
      ? buildSortedRootFolder(
          rootFolder,
          renamedNode?.isFolder
            ? updateFolderNode(rootFolder.children, oldPath, getNoteTitleFromPath(newPath), newPath)
            : updateFileNodePath(rootFolder.children, oldPath, newPath, getNoteTitleFromPath(newPath)),
          fileTreeSortMode,
          nextMetadata ?? noteMetadata
        )
      : rootFolder;
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    set({
      currentNote: nextCurrentNote,
      openTabs: nextOpenTabs,
      displayNames: nextDisplayNames,
      recentNotes: nextRecentNotes,
      noteContentsCache: nextCache,
      noteMetadata: nextMetadata ?? noteMetadata,
      rootFolder: nextRootFolder,
      starredEntries: starredResult.entries,
      starredNotes: starredPaths.notes,
      starredFolders: starredPaths.folders,
      error: null,
    });

    persistWorkspaceSnapshot(notesPath, {
      rootFolder: nextRootFolder,
      currentNotePath: nextCurrentNote?.path ?? null,
      fileTreeSortMode,
      expandedFolders: nextRootFolder
        ? remapExpandedFoldersForExternalRename(
            Array.from(collectExpandedPaths(nextRootFolder.children)),
            oldPath,
            newPath
          )
        : [],
    });
  },

  applyExternalPathDeletion: async (path: string) => {
    const {
      currentNote,
      openTabs,
      displayNames,
      noteContentsCache,
      noteMetadata,
      starredEntries,
      notesPath,
      isDirty,
      recentNotes,
      rootFolder,
      fileTreeSortMode,
    } = get();

    const preserveCurrentNote = shouldPreserveDeletedCurrentNote(currentNote, isDirty, path);
    const preservedPath = preserveCurrentNote ? currentNote?.path ?? null : null;
    const nextOpenTabs = pruneOpenTabsForExternalDeletion(openTabs, path, preservedPath);
    const nextDisplayNames = pruneDisplayNamesForExternalDeletion(displayNames, path, preservedPath);
    const nextRecentNotes = pruneRecentNotesForExternalDeletion(recentNotes, path, preservedPath);
    const nextCache = pruneCachedNoteContents(noteContentsCache, (cachedPath) => {
      if (preservedPath && cachedPath === preservedPath) {
        return false;
      }
      return cachedPath === path || cachedPath.startsWith(`${path}/`);
    });

    const nextMetadata = remapMetadataEntries(noteMetadata, (relativePath) => {
      if (preservedPath && relativePath === preservedPath) {
        return relativePath;
      }
      if (relativePath === path || relativePath.startsWith(`${path}/`)) {
        return null;
      }
      return relativePath;
    });

    const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
      if (preservedPath && relativePath === preservedPath) {
        return relativePath;
      }
      if (relativePath === path || relativePath.startsWith(`${path}/`)) {
        return null;
      }
      return relativePath;
    });

    if (starredResult.changed) {
      void saveStarredRegistry(starredResult.entries);
    }
    if (nextRecentNotes !== recentNotes) {
      persistRecentNotes(nextRecentNotes);
    }

    const nextRootFolder = rootFolder
      ? buildSortedRootFolder(
          rootFolder,
          removeNodeFromTree(rootFolder.children, path),
          fileTreeSortMode,
          nextMetadata ?? noteMetadata
        )
      : rootFolder;
    const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
    set({
      openTabs: nextOpenTabs,
      displayNames: nextDisplayNames,
      recentNotes: nextRecentNotes,
      noteContentsCache: nextCache,
      noteMetadata: nextMetadata ?? noteMetadata,
      rootFolder: nextRootFolder,
      starredEntries: starredResult.entries,
      starredNotes: starredPaths.notes,
      starredFolders: starredPaths.folders,
      error: null,
    });

    const nextCurrentNotePath =
      currentNote && !preserveCurrentNote && (currentNote.path === path || currentNote.path.startsWith(`${path}/`))
        ? nextOpenTabs[nextOpenTabs.length - 1]?.path ?? null
        : currentNote?.path ?? null;

    persistWorkspaceSnapshot(notesPath, {
      rootFolder: nextRootFolder,
      currentNotePath: nextCurrentNotePath,
      fileTreeSortMode,
      expandedFolders: nextRootFolder
        ? pruneExpandedFoldersForExternalDeletion(
            Array.from(collectExpandedPaths(nextRootFolder.children)),
            path
          )
        : [],
    });

    if (currentNote && !preserveCurrentNote && (currentNote.path === path || currentNote.path.startsWith(`${path}/`))) {
      if (nextOpenTabs.length > 0) {
        const lastTab = nextOpenTabs[nextOpenTabs.length - 1];
        if (lastTab) {
          void openStoredNotePath(lastTab.path, {
            openNote: get().openNote,
            openNoteByAbsolutePath: get().openNoteByAbsolutePath,
          });
        }
      } else {
        set({ currentNote: null, isDirty: false });
      }
    }
  },

  updateContent: (content: string) => {
    const { currentNote, noteContentsCache, openTabs } = get();
    if (!currentNote || currentNote.content === content) return;
    set({
      currentNote: { ...currentNote, content },
      isDirty: true,
      openTabs: setNoteTabDirtyState(openTabs, currentNote.path, true),
      noteContentsCache: setCachedNoteContent(
        noteContentsCache,
        currentNote.path,
        content,
        getCachedNoteModifiedAt(noteContentsCache, currentNote.path)
      ),
    });
  },

  closeNote: () => {
    const { notesPath, rootFolder, fileTreeSortMode } = get();
    set({ currentNote: null, isDirty: false });
    persistWorkspaceSnapshot(notesPath, {
      rootFolder,
      currentNotePath: null,
      fileTreeSortMode,
    });
  },

  closeTab: async (path: string) => {
    const {
      openTabs,
      currentNote,
      isDirty,
      saveNote,
      notesPath,
      rootFolder,
      fileTreeSortMode,
    } = get();

    const pathIsAbsolute = isAbsolutePath(path);

    const { isNewlyCreated } = get();
    const isEmptyNote =
      !pathIsAbsolute &&
      isNewlyCreated &&
      currentNote?.path === path &&
      (!currentNote.content.trim() ||
        currentNote.content.trim() === '#' ||
        currentNote.content.trim() === '# ' ||
        currentNote.content.trim().length === 0);

    if (isEmptyNote) {
      await get().deleteNote(path);
      return;
    }

    if (currentNote?.path === path && isDirty) {
      await saveNote();
      if (get().isDirty) return;
    }

    const updatedTabs = openTabs.filter((t) => t.path !== path);
    set({ openTabs: updatedTabs });

    if (currentNote?.path === path) {
      if (updatedTabs.length > 0) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        void openStoredNotePath(lastTab.path, {
          openNote: get().openNote,
          openNoteByAbsolutePath: get().openNoteByAbsolutePath,
        });
      } else {
        set({ currentNote: null, isDirty: false });
        persistWorkspaceSnapshot(notesPath, {
          rootFolder,
          currentNotePath: null,
          fileTreeSortMode,
        });
      }
    }
  },

  switchTab: (path: string) => {
    void openStoredNotePath(path, {
      openNote: get().openNote,
      openNoteByAbsolutePath: get().openNoteByAbsolutePath,
    });
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const { openTabs } = get();
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

    const tabs = [...openTabs];
    const [moved] = tabs.splice(fromIndex, 1);
    if (!moved) return;
    tabs.splice(toIndex, 0, moved);
    set({ openTabs: tabs });
  },

  syncDisplayName: (path: string, title: string) => {
    updateDisplayName(set, path, title);
  },

  getDisplayName: (path: string) => get().displayNames.get(path) ?? getNoteTitleFromPath(path),
});
