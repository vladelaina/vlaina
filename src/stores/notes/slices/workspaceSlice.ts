import { StateCreator } from 'zustand';
import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore } from '../types';
import { updateDisplayName } from '../displayNameUtils';
import {
  addToRecentNotes,
  persistRecentNotes,
  safeWriteTextFile,
  saveNoteMetadataOrThrow,
} from '../storage';
import {
  getNoteMetadataEntry,
  moveNoteMetadataEntry,
} from '../noteMetadataState';
import {
  addNodeToTree,
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
import { remapMetadataEntries, saveNoteMetadata } from '../storage';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import {
  getDraftNoteEntry,
  isDraftNoteEmpty,
  isDraftNotePath,
  resolveDraftNoteTitle,
} from '../draftNote';
import { chooseDraftSavePath, resolveDraftSaveLocation } from '../draftNoteSave';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';

export interface WorkspaceSlice {
  currentNote: NotesStore['currentNote'];
  currentNoteRevision: NotesStore['currentNoteRevision'];
  isDirty: NotesStore['isDirty'];
  isLoading: NotesStore['isLoading'];
  error: NotesStore['error'];
  openTabs: NotesStore['openTabs'];
  displayNames: NotesStore['displayNames'];
  pendingDraftDiscardPath: NotesStore['pendingDraftDiscardPath'];

  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string, openInNewTab?: boolean) => Promise<void>;
  saveNote: NotesStore['saveNote'];
  syncCurrentNoteFromDisk: NotesStore['syncCurrentNoteFromDisk'];
  invalidateNoteCache: NotesStore['invalidateNoteCache'];
  applyExternalPathRename: NotesStore['applyExternalPathRename'];
  applyExternalPathDeletion: NotesStore['applyExternalPathDeletion'];
  updateContent: (content: string) => void;
  closeNote: () => void;
  cancelPendingDraftDiscard: NotesStore['cancelPendingDraftDiscard'];
  confirmPendingDraftDiscard: NotesStore['confirmPendingDraftDiscard'];
  closeTab: (path: string) => Promise<void>;
  switchTab: (path: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  syncDisplayName: (path: string, title: string) => void;
  getDisplayName: (path: string) => string;
}

function buildOpenedTabs(
  openTabs: NotesStore['openTabs'],
  currentNotePath: string | null | undefined,
  nextPath: string,
  nextName: string,
  openInNewTab: boolean
) {
  const existingTab = openTabs.find((tab) => tab.path === nextPath);

  if (existingTab) {
    return openTabs.map((tab) => (tab.path === nextPath ? { ...tab, name: nextName } : tab));
  }

  if (openInNewTab || openTabs.length === 0) {
    return [...openTabs, { path: nextPath, name: nextName, isDirty: false }];
  }

  const currentTabIndex = openTabs.findIndex((tab) => tab.path === currentNotePath);
  if (currentTabIndex === -1) {
    return [...openTabs, { path: nextPath, name: nextName, isDirty: false }];
  }

  const nextTabs = [...openTabs];
  nextTabs[currentTabIndex] = { path: nextPath, name: nextName, isDirty: false };
  return nextTabs;
}

function getPersistedCurrentNotePath(path: string | null | undefined): string | null {
  if (!path || isDraftNotePath(path)) {
    return null;
  }

  return path;
}

async function finishClosingDraftTab(
  path: string,
  set: Parameters<StateCreator<NotesStore, [], [], WorkspaceSlice>>[0],
  get: Parameters<StateCreator<NotesStore, [], [], WorkspaceSlice>>[1],
) {
  if (!get().draftNotes[path]) {
    set({ pendingDraftDiscardPath: null });
    return;
  }

  const { currentNote, notesPath, rootFolder, fileTreeSortMode } = get();
  const isActiveDraft = currentNote?.path === path;

  get().discardDraftNote(path);
  set({ pendingDraftDiscardPath: null });

  if (!isActiveDraft) {
    return;
  }

  const updatedTabs = get().openTabs;
  if (updatedTabs.length > 0) {
    const lastTab = updatedTabs[updatedTabs.length - 1];
    if (lastTab) {
      void openStoredNotePath(lastTab.path, {
        openNote: get().openNote,
        openNoteByAbsolutePath: get().openNoteByAbsolutePath,
      });
    }
    return;
  }

  set({ currentNote: null, isDirty: false });
  persistWorkspaceSnapshot(notesPath, {
    rootFolder,
    currentNotePath: null,
    fileTreeSortMode,
  });
}

export const createWorkspaceSlice: StateCreator<NotesStore, [], [], WorkspaceSlice> = (
  set,
  get
) => ({
  currentNote: null,
  currentNoteRevision: 0,
  isDirty: false,
  isLoading: false,
  error: null,
  openTabs: [],
  displayNames: new Map(),
  pendingDraftDiscardPath: null,

  openNote: async (path: string, openInNewTab: boolean = false) => {
    let { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote, noteContentsCache, draftNotes } = get();
    if (isDirty && !isDraftNotePath(currentNote?.path)) {
      await saveNote();
      if (get().isDirty) return;
      ({ notesPath, recentNotes, openTabs, currentNote, noteContentsCache, draftNotes } = get());
    }

    const draftNote = getDraftNoteEntry(draftNotes, path);
    if (draftNote) {
      const content = noteContentsCache.get(path)?.content ?? '';
      const tabName = resolveDraftNoteTitle(draftNote.name);
      const updatedTabs = buildOpenedTabs(openTabs, currentNote?.path, path, tabName, openInNewTab);

      updateDisplayName(set, path, tabName);
      set({
        currentNote: { path, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: updatedTabs.find((tab) => tab.path === path)?.isDirty ?? true,
        error: null,
        openTabs: updatedTabs,
        isNewlyCreated: false,
      });

      const { rootFolder, fileTreeSortMode } = get();
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: null,
        fileTreeSortMode,
      });
      return;
    }

    try {
      const { content, nextCache } = await loadNoteDocument({
        notesPath,
        path,
        cache: noteContentsCache,
      });
      const fileName = getNoteTitleFromPath(path);
      const tabName = fileName;
      const updatedRecent = addToRecentNotes(path, recentNotes);
      const updatedTabs = buildOpenedTabs(openTabs, currentNote?.path, path, tabName, openInNewTab);

      updateDisplayName(set, path, tabName);
      set({
        currentNote: { path, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: false,
        error: null,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: nextCache,
      });

      const { rootFolder, fileTreeSortMode } = get();
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: getPersistedCurrentNotePath(path),
        fileTreeSortMode,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    let { notesPath, isDirty, saveNote, openTabs, currentNote, noteContentsCache } = get();
    if (isDirty && !isDraftNotePath(currentNote?.path)) {
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
      const fileName = getNoteTitleFromPath(absolutePath);
      const tabName = fileName;
      const updatedTabs = buildOpenedTabs(
        openTabs,
        currentNote?.path,
        absolutePath,
        tabName,
        openInNewTab
      );

      updateDisplayName(set, absolutePath, tabName);
      set({
        currentNote: { path: absolutePath, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: false,
        error: null,
        openTabs: updatedTabs,
        isNewlyCreated: false,
        noteContentsCache: nextCache,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  saveNote: async (options) => {
    const explicit = options?.explicit ?? false;
    const {
      currentNote,
      notesPath,
      noteContentsCache,
      draftNotes,
      recentNotes,
      rootFolder,
      fileTreeSortMode,
      openTabs,
      currentNoteRevision,
      displayNames,
      noteMetadata,
    } = get();
    if (!currentNote) return;

    const draftNote = getDraftNoteEntry(draftNotes, currentNote.path);
    if (draftNote) {
      if (!explicit) {
        return;
      }

      try {
        const selectedPath = await chooseDraftSavePath(notesPath, draftNote);
        if (!selectedPath) {
          return;
        }

        const { absolutePath, relativePath } = resolveDraftSaveLocation(selectedPath, notesPath);
        const savedPath = relativePath ?? absolutePath;
        const savedTitle = getNoteTitleFromPath(savedPath);
        const nextCache = removeCachedNoteContent(noteContentsCache, currentNote.path);
        const nextTabs = openTabs.map((tab) =>
          tab.path === currentNote.path
            ? { path: savedPath, name: savedTitle, isDirty: false }
            : tab,
        );
        const nextDraftNotes = { ...draftNotes };
        delete nextDraftNotes[currentNote.path];
        const nextDisplayNames = new Map(displayNames);
        nextDisplayNames.delete(currentNote.path);
        nextDisplayNames.set(savedPath, savedTitle);
        const draftMetadataEntry = getNoteMetadataEntry(noteMetadata, currentNote.path);

        markExpectedExternalChange(absolutePath);
        await safeWriteTextFile(absolutePath, currentNote.content);

        if (relativePath) {
          const currentRootFolder = rootFolder ?? {
            id: '',
            name: 'Notes',
            path: '',
            isFolder: true as const,
            children: [],
            expanded: true,
          };
          const parentPath = relativePath.includes('/')
            ? relativePath.substring(0, relativePath.lastIndexOf('/'))
            : undefined;
          const now = Date.now();
          const updatedMetadata = moveNoteMetadataEntry(noteMetadata, currentNote.path, relativePath, {
            createdAt: draftMetadataEntry?.createdAt ?? now,
            updatedAt: now,
          });
          await saveNoteMetadataOrThrow(notesPath, updatedMetadata);
          const nextRootFolder = buildSortedRootFolder(
            currentRootFolder,
            addNodeToTree(currentRootFolder.children, parentPath, {
              id: relativePath,
              name: savedTitle,
              path: relativePath,
              isFolder: false as const,
            }),
            fileTreeSortMode,
            updatedMetadata,
          );
          const updatedRecent = addToRecentNotes(relativePath, recentNotes);

          set({
            currentNote: { path: relativePath, content: currentNote.content },
            currentNoteRevision: currentNoteRevision + 1,
            isDirty: false,
            noteMetadata: updatedMetadata,
            noteContentsCache: setCachedNoteContent(nextCache, relativePath, currentNote.content, null),
            openTabs: nextTabs,
            recentNotes: updatedRecent,
            rootFolder: nextRootFolder,
            draftNotes: nextDraftNotes,
            displayNames: nextDisplayNames,
            isNewlyCreated: false,
            error: null,
          });

          persistWorkspaceSnapshot(notesPath, {
            rootFolder: nextRootFolder,
            currentNotePath: relativePath,
            fileTreeSortMode,
          });
          return;
        }

        const nextMetadata = draftMetadataEntry
          ? moveNoteMetadataEntry(noteMetadata, currentNote.path, absolutePath, {
              updatedAt: Date.now(),
            })
          : noteMetadata;

        set({
          currentNote: { path: absolutePath, content: currentNote.content },
          currentNoteRevision: currentNoteRevision + 1,
          isDirty: false,
          noteMetadata: nextMetadata,
          noteContentsCache: setCachedNoteContent(nextCache, absolutePath, currentNote.content, null),
          openTabs: nextTabs,
          draftNotes: nextDraftNotes,
          displayNames: nextDisplayNames,
          isNewlyCreated: false,
          error: null,
        });

        if (notesPath) {
          persistWorkspaceSnapshot(notesPath, {
            rootFolder,
            currentNotePath: null,
            fileTreeSortMode,
          });
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to save note' });
      }
      return;
    }

    if (!notesPath && isAbsolutePath(currentNote.path)) {
      try {
        const storage = getStorageAdapter();
        markExpectedExternalChange(currentNote.path);
        await safeWriteTextFile(currentNote.path, currentNote.content);

        const fileInfo = await storage.stat(currentNote.path);
        const modifiedAt = fileInfo?.modifiedAt ?? null;

        set({
          isDirty: false,
          noteContentsCache: setCachedNoteContent(noteContentsCache, currentNote.path, currentNote.content, modifiedAt),
          openTabs: setNoteTabDirtyState(get().openTabs, currentNote.path, false),
          error: null,
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to save note' });
      }
      return;
    }

    try {
      const { nextCache, updatedMetadata } = await saveNoteDocument({
        notesPath,
        currentNote,
        cache: noteContentsCache,
      });

      set({
        isDirty: false,
        noteMetadata: updatedMetadata,
        noteContentsCache: nextCache,
        openTabs: setNoteTabDirtyState(get().openTabs, currentNote.path, false),
        error: null,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save note' });
    }
  },

  syncCurrentNoteFromDisk: async () => {
    const { currentNote, notesPath, isDirty, noteContentsCache, openTabs } = get();
    if (!currentNote) {
      return 'ignored';
    }

    if (isDraftNotePath(currentNote.path)) {
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
      set({
        currentNote: { path: currentNote.path, content: nextContent },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: false,
        openTabs: setNoteTabDirtyState(openTabs, currentNote.path, false),
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

    if (nextMetadata !== noteMetadata && nextMetadata) {
      void saveNoteMetadata(notesPath, nextMetadata);
    }
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

    if (nextMetadata !== noteMetadata && nextMetadata) {
      void saveNoteMetadata(notesPath, nextMetadata);
    }
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

  cancelPendingDraftDiscard: () => {
    set({ pendingDraftDiscardPath: null });
  },

  confirmPendingDraftDiscard: async () => {
    const { pendingDraftDiscardPath } = get();
    if (!pendingDraftDiscardPath) {
      return;
    }

    await finishClosingDraftTab(pendingDraftDiscardPath, set, get);
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

    if (isDraftNotePath(path)) {
      const draftContent = currentNote?.path === path
        ? currentNote?.content ?? ''
        : get().noteContentsCache.get(path)?.content ?? '';

      if (!isDraftNoteEmpty(draftContent)) {
        set({ pendingDraftDiscardPath: path });
        return;
      }

      await finishClosingDraftTab(path, set, get);
      return;
    }

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
