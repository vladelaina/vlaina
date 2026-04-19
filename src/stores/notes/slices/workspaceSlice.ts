import { StateCreator } from 'zustand';
import { getParentPath, getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
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
  addNodeToTree,
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
import { resolveDraftNoteTitle } from '../draftNote';
import { chooseDraftSavePath, resolveDraftSaveLocation } from '../draftNoteSave';
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
  pruneRecentlyClosedTabsForExternalDeletion,
  pushRecentlyClosedTab,
  remapRecentlyClosedTabsForExternalRename,
  restoreClosedTabOrder,
} from '../document/recentlyClosedTabState';
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
import { dispatchOpenMarkdownTargetEvent } from '@/components/Notes/features/OpenTarget/openTargetEvents';
import { logNotesDebug } from '../debugLog';

export interface WorkspaceSlice {
  currentNote: NotesStore['currentNote'];
  currentNoteRevision: NotesStore['currentNoteRevision'];
  isDirty: NotesStore['isDirty'];
  isLoading: NotesStore['isLoading'];
  error: NotesStore['error'];
  openTabs: NotesStore['openTabs'];
  recentlyClosedTabs: NotesStore['recentlyClosedTabs'];
  draftNotes: NotesStore['draftNotes'];
  pendingDraftDiscardPath: NotesStore['pendingDraftDiscardPath'];
  displayNames: NotesStore['displayNames'];

  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string, openInNewTab?: boolean) => Promise<void>;
  adoptAbsoluteNoteIntoVault: (absolutePath: string, nextPath: string) => boolean;
  saveNote: NotesStore['saveNote'];
  syncCurrentNoteFromDisk: NotesStore['syncCurrentNoteFromDisk'];
  invalidateNoteCache: NotesStore['invalidateNoteCache'];
  applyExternalPathRename: NotesStore['applyExternalPathRename'];
  applyExternalPathDeletion: NotesStore['applyExternalPathDeletion'];
  updateContent: (content: string) => void;
  updateDraftNoteName: (path: string, name: string) => void;
  discardDraftNote: (path: string) => void;
  cancelPendingDraftDiscard: () => void;
  confirmPendingDraftDiscard: () => Promise<void>;
  closeNote: () => void;
  closeTab: (path: string) => Promise<void>;
  reopenClosedTab: () => Promise<void>;
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
  currentNoteRevision: 0,
  isDirty: false,
  isLoading: false,
  error: null,
  openTabs: [],
  recentlyClosedTabs: [],
  draftNotes: {},
  pendingDraftDiscardPath: null,
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
        currentNoteRevision: get().currentNoteRevision + 1,
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
        currentNoteRevision: get().currentNoteRevision + 1,
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

  adoptAbsoluteNoteIntoVault: (absolutePath: string, nextPath: string) => {
    const { currentNote, openTabs, noteContentsCache, noteMetadata, displayNames, recentNotes } = get();
    if (currentNote?.path !== absolutePath) {
      return false;
    }

    set({
      currentNote: remapCurrentNoteForExternalRename(currentNote, absolutePath, nextPath),
      currentNoteRevision: get().currentNoteRevision + 1,
      openTabs: remapOpenTabsForExternalRename(openTabs, absolutePath, nextPath),
      noteContentsCache: remapCachedNoteContents(noteContentsCache, (path) =>
        path === absolutePath ? nextPath : path
      ),
      noteMetadata: remapMetadataEntries(noteMetadata, (path) =>
        path === absolutePath ? nextPath : path
      ),
      displayNames: remapDisplayNamesForExternalRename(displayNames, absolutePath, nextPath),
      recentNotes: remapRecentNotesForExternalRename(recentNotes, absolutePath, nextPath),
    });

    return true;
  },

  saveNote: async (options) => {
    const {
      currentNote,
      notesPath,
      noteContentsCache,
      noteMetadata,
      rootFolder,
      fileTreeSortMode,
      draftNotes,
      openTabs,
      recentNotes,
      displayNames,
      pendingDraftDiscardPath,
    } = get();
    if (!currentNote) {
      logNotesDebug('workspaceSlice:saveNote:ignored-no-current-note');
      return;
    }

    try {
      logNotesDebug('workspaceSlice:saveNote:start', {
        notePath: currentNote.path,
        explicit: options?.explicit ?? false,
        isDirty: get().isDirty,
      });

      const draftNote = draftNotes[currentNote.path];
      if (draftNote) {
        if (!options?.explicit) {
          return;
        }

        const selectedPath = await chooseDraftSavePath(notesPath, draftNote);
        if (!selectedPath) {
          return;
        }

        const { absolutePath, relativePath } = resolveDraftSaveLocation(selectedPath, notesPath);
        const savedPath = relativePath ?? absolutePath;
        const { content, metadata, nextCache } = await saveNoteDocument({
          notesPath,
          currentNote: { path: savedPath, content: currentNote.content },
          cache: noteContentsCache,
        });

        const tabName = getNoteTitleFromPath(savedPath);
        const nextTabs = openTabs
          .map((tab) =>
            tab.path === currentNote.path
              ? { path: savedPath, name: tabName, isDirty: false }
              : tab,
          )
          .filter((tab, index, tabs) => tabs.findIndex((candidate) => candidate.path === tab.path) === index);

        const nextDisplayNames = new Map(displayNames);
        nextDisplayNames.delete(currentNote.path);
        nextDisplayNames.set(savedPath, tabName);

        const nextDraftNotes = { ...draftNotes };
        delete nextDraftNotes[currentNote.path];

        let nextMetadata = remapMetadataEntries(noteMetadata ?? createEmptyMetadataFile(), (path) => {
          if (path === currentNote.path) {
            return relativePath ?? null;
          }
          return path;
        }) ?? createEmptyMetadataFile();

        nextMetadata = setNoteEntry(nextMetadata, savedPath, metadata);

        const nextCacheWithSavedNote = removeCachedNoteContent(nextCache, currentNote.path);
        const nextRecentNotes = relativePath ? addToRecentNotes(relativePath, recentNotes) : recentNotes;
        if (nextRecentNotes !== recentNotes) {
          persistRecentNotes(nextRecentNotes);
        }

        let nextRootFolder = rootFolder;
        if (relativePath && rootFolder && !findNode(rootFolder.children, relativePath)) {
          nextRootFolder = buildSortedRootFolder(
            rootFolder,
            addNodeToTree(rootFolder.children, getParentPath(relativePath), {
              id: relativePath,
              name: tabName,
              path: relativePath,
              isFolder: false as const,
            }),
            fileTreeSortMode,
            nextMetadata,
          );
        } else if (relativePath) {
          nextRootFolder = buildSortedRootFolder(
            rootFolder,
            rootFolder?.children ?? [],
            fileTreeSortMode,
            nextMetadata,
          );
        }

        set({
          currentNote: { path: savedPath, content },
          currentNoteRevision: get().currentNoteRevision + 1,
          isDirty: false,
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: nextCacheWithSavedNote,
          openTabs: nextTabs,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          draftNotes: nextDraftNotes,
          pendingDraftDiscardPath: pendingDraftDiscardPath === currentNote.path ? null : pendingDraftDiscardPath,
          error: null,
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: relativePath ?? null,
          fileTreeSortMode,
        });

        if (!relativePath && !options?.suppressOpenTarget) {
          dispatchOpenMarkdownTargetEvent(absolutePath);
        }

        logNotesDebug('workspaceSlice:saveNote:finish', {
          notePath: savedPath,
          explicit: options?.explicit ?? false,
          wasDraft: true,
          relativePath: relativePath ?? null,
        });
        return;
      }

      const { content, metadata, nextCache } = await saveNoteDocument({
        notesPath,
        currentNote,
        cache: noteContentsCache,
      });
      const nextMetadata = setNoteEntry(
        noteMetadata ?? createEmptyMetadataFile(),
        currentNote.path,
        metadata,
      );
      const nextRootFolder = buildSortedRootFolder(
        rootFolder,
        rootFolder?.children ?? [],
        fileTreeSortMode,
        nextMetadata,
      );

      set({
        currentNote: { path: currentNote.path, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: false,
        noteMetadata: nextMetadata,
        rootFolder: nextRootFolder,
        noteContentsCache: nextCache,
        openTabs: setNoteTabDirtyState(get().openTabs, currentNote.path, false),
        error: null,
      });
      logNotesDebug('workspaceSlice:saveNote:finish', {
        notePath: currentNote.path,
        explicit: options?.explicit ?? false,
        wasDraft: false,
      });
    } catch (error) {
      logNotesDebug('workspaceSlice:saveNote:error', {
        notePath: currentNote.path,
        explicit: options?.explicit ?? false,
        error,
      });
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
      logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:start', {
        notePath: currentNote.path,
        fullPath,
        isDirty,
        exists,
        cachedModifiedAt,
        nextModifiedAt: fileInfo?.modifiedAt ?? null,
      });

      if (!exists || fileInfo?.isFile === false) {
        if (isDirty) {
          logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:deleted-conflict', {
            notePath: currentNote.path,
          });
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

        logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:deleted', {
          notePath: currentNote.path,
          remainingTabCount: updatedTabs.length,
        });
        return 'deleted';
      }

      const nextModifiedAt = fileInfo?.modifiedAt ?? cachedModifiedAt ?? null;
      if (nextModifiedAt === cachedModifiedAt) {
        logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:unchanged', {
          notePath: currentNote.path,
          modifiedAt: nextModifiedAt,
        });
        return 'unchanged';
      }

      if (isDirty) {
        logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:conflict', {
          notePath: currentNote.path,
          cachedModifiedAt,
          nextModifiedAt,
        });
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

      logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:reloaded', {
        notePath: currentNote.path,
        cachedModifiedAt,
        nextModifiedAt,
        contentLength: nextContent.length,
      });
      return 'reloaded';
    } catch (error) {
      logNotesDebug('workspaceSlice:syncCurrentNoteFromDisk:error', {
        notePath: currentNote.path,
        error,
      });
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
      recentlyClosedTabs,
      notesPath,
      recentNotes,
      rootFolder,
      fileTreeSortMode,
    } = get();

    const nextCurrentNote = remapCurrentNoteForExternalRename(currentNote, oldPath, newPath);
    const nextOpenTabs = remapOpenTabsForExternalRename(openTabs, oldPath, newPath);
    const nextDisplayNames = remapDisplayNamesForExternalRename(displayNames, oldPath, newPath);
    const nextRecentNotes = remapRecentNotesForExternalRename(recentNotes, oldPath, newPath);
    const nextRecentlyClosedTabs = remapRecentlyClosedTabsForExternalRename(recentlyClosedTabs, oldPath, newPath);
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
      recentlyClosedTabs: nextRecentlyClosedTabs,
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
      recentlyClosedTabs,
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
    const nextRecentlyClosedTabs = pruneRecentlyClosedTabsForExternalDeletion(recentlyClosedTabs, path);
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
      recentlyClosedTabs: nextRecentlyClosedTabs,
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
      currentNoteRevision: get().currentNoteRevision + 1,
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

  updateDraftNoteName: (path: string, name: string) => {
    const draftEntry = get().draftNotes[path];
    if (!draftEntry) {
      return;
    }

    set({
      draftNotes: {
        ...get().draftNotes,
        [path]: {
          ...draftEntry,
          name,
        },
      },
    });
  },

  discardDraftNote: (path: string) => {
    const { draftNotes, openTabs, currentNote, noteContentsCache, pendingDraftDiscardPath, isDirty } = get();
    if (!draftNotes[path]) {
      return;
    }

    const { [path]: _removedDraft, ...nextDraftNotes } = draftNotes;
    const isCurrentDraft = currentNote?.path === path;

    set({
      draftNotes: nextDraftNotes,
      openTabs: openTabs.filter((tab) => tab.path !== path),
      currentNote: isCurrentDraft ? null : currentNote,
      currentNoteRevision: isCurrentDraft ? get().currentNoteRevision + 1 : get().currentNoteRevision,
      noteContentsCache: removeCachedNoteContent(noteContentsCache, path),
      isDirty: isCurrentDraft ? false : isDirty,
      pendingDraftDiscardPath: pendingDraftDiscardPath === path ? null : pendingDraftDiscardPath,
    });
  },

  cancelPendingDraftDiscard: () => {
    set({ pendingDraftDiscardPath: null });
  },

  confirmPendingDraftDiscard: async () => {
    const pendingPath = get().pendingDraftDiscardPath;
    if (!pendingPath) {
      return;
    }

    set({ pendingDraftDiscardPath: null });
    get().discardDraftNote(pendingPath);
  },

  closeNote: () => {
    const { notesPath, rootFolder, fileTreeSortMode } = get();
    set({
      currentNote: null,
      currentNoteRevision: get().currentNoteRevision + 1,
      isDirty: false,
    });
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
      recentlyClosedTabs,
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

    const closedTab = openTabs.find((tab) => tab.path === path);
    const updatedTabs = openTabs.filter((t) => t.path !== path);
    set({
      openTabs: updatedTabs,
      recentlyClosedTabs: closedTab
        ? pushRecentlyClosedTab(recentlyClosedTabs, closedTab, openTabs.findIndex((tab) => tab.path === path))
        : recentlyClosedTabs,
    });

    if (currentNote?.path === path) {
      if (updatedTabs.length > 0) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        if (lastTab) {
          void openStoredNotePath(lastTab.path, {
            openNote: get().openNote,
            openNoteByAbsolutePath: get().openNoteByAbsolutePath,
          });
        }
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

  reopenClosedTab: async () => {
    const closedTabs = get().recentlyClosedTabs;
    if (closedTabs.length === 0) {
      return;
    }

    for (let index = 0; index < closedTabs.length; index += 1) {
      const entry = closedTabs[index];
      if (!entry) {
        continue;
      }

      const remainingTabs = closedTabs.slice(index + 1);
      const wasDirty = get().isDirty;
      const previousPath = get().currentNote?.path ?? null;
      const alreadyOpen = get().openTabs.some((tab) => tab.path === entry.tab.path);

      await openStoredNotePath(
        entry.tab.path,
        {
          openNote: get().openNote,
          openNoteByAbsolutePath: get().openNoteByAbsolutePath,
        },
        alreadyOpen ? undefined : { openInNewTab: true },
      );

      const nextState = get();
      const reopened = nextState.currentNote?.path === entry.tab.path && nextState.openTabs.some((tab) => tab.path === entry.tab.path);
      if (reopened) {
        set({
          openTabs: alreadyOpen
            ? nextState.openTabs
            : restoreClosedTabOrder(nextState.openTabs, entry.tab.path, entry.index),
          recentlyClosedTabs: remainingTabs,
        });
        return;
      }

      if (wasDirty && nextState.isDirty && nextState.currentNote?.path === previousPath) {
        return;
      }

      set({ recentlyClosedTabs: remainingTabs });
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

  getDisplayName: (path: string) => {
    const draftNote = get().draftNotes[path];
    if (draftNote) {
      return resolveDraftNoteTitle(draftNote.name);
    }

    return get().displayNames.get(path) ?? getNoteTitleFromPath(path);
  },
});
