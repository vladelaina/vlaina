import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore } from '../types';
import {
  buildFileTree,
  updateFolderExpanded,
  updateFolderNode,
  expandFoldersForPath,
  restoreExpandedState,
  addNodeToTree,
} from '../fileTreeUtils';
import {
  DEFAULT_FILE_TREE_SORT_MODE,
  sortNestedFileTree,
} from '../fileTreeSorting';
import {
  getNotesBasePath,
  ensureNotesFolder,
  loadNoteMetadata,
  loadWorkspaceState,
  persistRecentNotes,
} from '../storage';
import { getVaultStarredPaths } from '../starred';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { processFolderRename } from '../utils/fs/batchOperations';
import { deleteNoteImpl, deleteFolderImpl } from '../utils/fs/deleteOperations';
import { isInvalidMoveTarget } from '../utils/fs/moveValidation';
import { getStateForPathDeletion, getStateForPathRename } from '../utils/fs/pathStateEffects';
import { resolveUniquePath, resolveUniqueRenamedPath } from '../utils/fs/pathOperations';
import { renameNoteImpl, moveItemImpl } from '../utils/fs/renameOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { uploadNoteAssetImpl } from '../utils/fs/uploadOperations';
import {
  setCachedNoteContent,
} from '../document/noteContentCache';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import {
} from '../document/externalPathSync';

export interface FileSystemSlice {
  rootFolder: NotesStore['rootFolder'];
  notesPath: NotesStore['notesPath'];
  isNewlyCreated: NotesStore['isNewlyCreated'];
  newlyCreatedFolderPath: NotesStore['newlyCreatedFolderPath'];
  fileTreeSortMode: NotesStore['fileTreeSortMode'];

  loadFileTree: (skipRestore?: boolean) => Promise<void>;
  toggleFolder: (path: string) => void;
  revealFolder: (path: string) => void;
  createNote: (folderPath?: string) => Promise<string>;
  createNoteWithContent: (
    folderPath: string | undefined,
    name: string,
    content: string
  ) => Promise<string>;
  deleteNote: (path: string) => Promise<void>;
  renameNote: (path: string, newName: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  createFolder: (parentPath: string, name?: string) => Promise<string | null>;
  clearNewlyCreatedFolder: () => void;
  deleteFolder: (path: string) => Promise<void>;
  moveItem: (sourcePath: string, targetFolderPath: string) => Promise<void>;
  uploadNoteAsset: (notePath: string, file: File) => Promise<string | null>;
  setFileTreeSortMode: NotesStore['setFileTreeSortMode'];
}

function isPathWithinFolder(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

function ensureRootFolderState(rootFolder: NotesStore['rootFolder']): NonNullable<NotesStore['rootFolder']> {
  return (
    rootFolder ?? {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    }
  );
}

function replaceCurrentTabOrAppend(
  openTabs: NotesStore['openTabs'],
  currentNotePath: string | null | undefined,
  nextTab: NotesStore['openTabs'][number],
) {
  if (!currentNotePath) {
    return [...openTabs, nextTab];
  }

  const currentTabIndex = openTabs.findIndex((tab) => tab.path === currentNotePath);
  if (currentTabIndex === -1) {
    return [...openTabs, nextTab];
  }

  const nextTabs = [...openTabs];
  nextTabs[currentTabIndex] = nextTab;
  return nextTabs;
}

export const createFileSystemSlice: StateCreator<NotesStore, [], [], FileSystemSlice> = (
  set,
  get
) => ({
  rootFolder: null,
  notesPath: '',
  isNewlyCreated: false,
  newlyCreatedFolderPath: null,
  fileTreeSortMode: DEFAULT_FILE_TREE_SORT_MODE,

  loadFileTree: async (skipRestore = false) => {
    set({ isLoading: true, error: null });
    try {
      const storage = getStorageAdapter();
      const basePath = await getNotesBasePath();

      await ensureNotesFolder(basePath);
      const metadata = await loadNoteMetadata(basePath);
      const workspace = await loadWorkspaceState(basePath);
      const fileTreeSortMode = workspace?.fileTreeSortMode ?? DEFAULT_FILE_TREE_SORT_MODE;
      const children = sortNestedFileTree(await buildFileTree(basePath), {
        mode: fileTreeSortMode,
        metadata,
      });
      const starredPaths = getVaultStarredPaths(get().starredEntries, basePath);

      let restoredChildren = children;
      if (workspace?.expandedFolders?.length) {
        const expandedSet = new Set(workspace.expandedFolders);
        restoredChildren = restoreExpandedState(children, expandedSet);
      }

      set({
        notesPath: basePath,
        rootFolder: {
          id: '',
          name: 'Notes',
          path: '',
          isFolder: true,
          children: restoredChildren,
          expanded: true,
        },
        noteMetadata: metadata,
        starredNotes: starredPaths.notes,
        starredFolders: starredPaths.folders,
        isLoading: false,
        fileTreeSortMode,
      });

      if (!skipRestore && workspace?.currentNotePath) {
        setTimeout(async () => {
          try {
            const fullPath = await joinPath(basePath, workspace.currentNotePath!);
            const fileExists = await storage.exists(fullPath);
            if (fileExists) {
              get().openNote(workspace.currentNotePath!);
            }
          } catch {
          }
        }, 0);
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load notes',
        isLoading: false,
      });
    }
  },

  toggleFolder: (path: string) => {
    const { rootFolder, notesPath, fileTreeSortMode } = get();
    if (!rootFolder) return;
    const updatedChildren = updateFolderExpanded(rootFolder.children, path);
    set({ rootFolder: { ...rootFolder, children: updatedChildren } });

    const { currentNote } = get();
    persistWorkspaceSnapshot(notesPath, {
      rootFolder: { ...rootFolder, children: updatedChildren },
      currentNotePath: currentNote?.path || null,
      fileTreeSortMode,
    });
  },

  revealFolder: (path: string) => {
    const { rootFolder, notesPath, currentNote, fileTreeSortMode } = get();
    if (!rootFolder) return;

    const updatedChildren = expandFoldersForPath(rootFolder.children, path);
    set({ rootFolder: { ...rootFolder, children: updatedChildren } });

    persistWorkspaceSnapshot(notesPath, {
      rootFolder: { ...rootFolder, children: updatedChildren },
      currentNotePath: currentNote?.path || null,
      fileTreeSortMode,
    });
  },

  createNote: async (folderPath?: string) => {
    let {
      notesPath,
      openTabs,
      recentNotes,
      rootFolder,
      currentNote,
      isDirty,
      saveNote,
      fileTreeSortMode,
      noteContentsCache,
    } = get();

    try {
      if (isDirty) {
        await saveNote();
        if (get().isDirty) {
          throw new Error('Failed to save current note before creating a new note');
        }
        ({ openTabs, recentNotes, rootFolder, currentNote, noteContentsCache } = get());
      }

      if (!notesPath) {
        notesPath = await getNotesBasePath();
        await ensureNotesFolder(notesPath);
        set({ notesPath });
      }

      const currentRootFolder = ensureRootFolderState(rootFolder);
      const { 
          relativePath, 
          fileName, 
          updatedMetadata, 
          newChildren, 
          updatedRecent 
      } = await createNoteImpl(notesPath, folderPath, undefined, '', {
        rootFolder: currentRootFolder,
        recentNotes,
      });

      const nextRootFolder = buildSortedRootFolder(
        currentRootFolder,
        newChildren,
        fileTreeSortMode,
        updatedMetadata
      );

      set({
        rootFolder: nextRootFolder,
        noteMetadata: updatedMetadata,
      });

      const tabName = getNoteTitleFromPath(fileName);
      const newTab = { path: relativePath, name: tabName, isDirty: false };
      const updatedTabs = replaceCurrentTabOrAppend(openTabs, currentNote?.path, newTab);

      set({
        currentNote: { path: relativePath, content: '' },
        isDirty: false,
        openTabs: updatedTabs,
        recentNotes: updatedRecent,
        isNewlyCreated: true,
        noteContentsCache: setCachedNoteContent(noteContentsCache, relativePath, '', null),
      });
      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: relativePath,
        fileTreeSortMode,
      });
      return relativePath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create note' });
      throw error;
    }
  },

  createNoteWithContent: async (
    folderPath: string | undefined,
    name: string,
    content: string
  ) => {
    let {
      notesPath,
      rootFolder,
      recentNotes,
      openTabs,
      currentNote,
      isDirty,
      saveNote,
      fileTreeSortMode,
      noteContentsCache,
    } = get();
    const storage = getStorageAdapter();

    try {
      if (isDirty) {
        await saveNote();
        if (get().isDirty) {
          throw new Error('Failed to save current note before creating a new note');
        }
        ({ rootFolder, recentNotes, openTabs, currentNote, noteContentsCache } = get());
      }

      if (!notesPath) {
        notesPath = await getNotesBasePath();
        await ensureNotesFolder(notesPath);
        set({ notesPath });
      }

      const currentRootFolder = ensureRootFolderState(rootFolder);
      if (folderPath) {
        const folderFullPath = await joinPath(notesPath, folderPath);
        if (!await storage.exists(folderFullPath)) {
            await storage.mkdir(folderFullPath, true);
        }
      }

      const { 
          relativePath, 
          fileName,
          updatedMetadata, 
          newChildren, 
          updatedRecent 
      } = await createNoteImpl(notesPath, folderPath, name, content, {
        rootFolder: currentRootFolder,
        recentNotes,
      });

      const nextRootFolder = buildSortedRootFolder(
        currentRootFolder,
        newChildren,
        fileTreeSortMode,
        updatedMetadata
      );

      set({
        rootFolder: nextRootFolder,
        noteMetadata: updatedMetadata,
      });

      const tabName = getNoteTitleFromPath(fileName);
      const updatedTabs = replaceCurrentTabOrAppend(openTabs, currentNote?.path, {
        path: relativePath,
        name: tabName,
        isDirty: false,
      });

      set({
        currentNote: { path: relativePath, content },
        isDirty: false,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
        noteContentsCache: setCachedNoteContent(noteContentsCache, relativePath, content, null),
      });
      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: relativePath,
        fileTreeSortMode,
      });
      return relativePath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create note' });
      throw error;
    }
  },

  deleteNote: async (path: string) => {
    const {
      notesPath,
      rootFolder,
      currentNote,
      openTabs,
      recentNotes,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
      noteContentsCache,
      displayNames,
    } = get();
    try {
        const result = await deleteNoteImpl(
          notesPath,
          path,
          { rootFolder, currentNote, openTabs, starredEntries, noteMetadata }
        );

        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = getStateForPathDeletion({
          path,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        if (nextRecentNotes !== recentNotes) {
          persistRecentNotes(nextRecentNotes);
        }
        
        set({ 
            openTabs: result.updatedTabs,
            starredEntries: result.updatedStarredEntries,
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteMetadata: result.updatedMetadata ?? noteMetadata,
            noteContentsCache: nextNoteContentsCache,
        });

        if (currentNote?.path === path) {
          set({ currentNote: null, isDirty: false });
        }

        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.newChildren,
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata
        );
        if (nextRootFolder) {
          set({ rootFolder: nextRootFolder });
        }

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath:
            result.nextAction?.path ??
            (currentNote?.path === path ? null : currentNote?.path ?? null),
          fileTreeSortMode,
        });

        if (result.nextAction && result.nextAction.type === 'open') {
            await get().openNote(result.nextAction.path);
        }
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
    }
  },

  renameNote: async (path: string, newName: string) => {
    const {
      notesPath,
      rootFolder,
      currentNote,
      openTabs,
      starredEntries,
      noteMetadata,
      fileTreeSortMode,
      noteContentsCache,
      recentNotes,
      displayNames,
    } = get();
    try {
        const result = await renameNoteImpl(
            notesPath, path, newName, 
            { rootFolder, currentNote, openTabs, starredEntries, noteMetadata }
        );

        if (!result) return;

        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = getStateForPathRename({
          oldPath: path,
          newPath: result.newPath,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        if (nextRecentNotes !== recentNotes) {
          persistRecentNotes(nextRecentNotes);
        }

        set({
            starredEntries: result.updatedStarredEntries,
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
            noteMetadata: result.updatedMetadata,
            openTabs: result.updatedTabs,
            currentNote: result.nextCurrentNote,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteContentsCache: nextNoteContentsCache,
        });

        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.updatedChildren,
          fileTreeSortMode,
          result.updatedMetadata
        );
        if (nextRootFolder) {
          set({ rootFolder: nextRootFolder });
        }
        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: result.nextCurrentNote?.path ?? null,
          fileTreeSortMode,
        });
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
    }
  },

  renameFolder: async (path: string, newName: string) => {
    const {
      notesPath,
      rootFolder,
      currentNote,
      openTabs,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
      noteContentsCache,
      recentNotes,
      displayNames,
    } = get();
    const storage = getStorageAdapter();

    try {
      const fullPath = await joinPath(notesPath, path);
      const {
        relativePath: newPath,
        fullPath: newFullPath,
        fileName: resolvedFolderName,
      } = await resolveUniqueRenamedPath(notesPath, path, newName, true);

      if (newPath === path) {
        return;
      }

      markExpectedExternalChange(fullPath, true);
      markExpectedExternalChange(newFullPath, true);
      await storage.rename(fullPath, newFullPath);

      const {
          updatedStarredEntries,
          updatedStarredFolders,
          updatedStarredNotes,
          updatedTabs,
          updatedCurrentNote,
          updatedMetadata,
      } = await processFolderRename(
        notesPath,
        path,
        resolvedFolderName,
        { rootFolder, currentNote, openTabs, starredEntries, noteMetadata }
      );

      const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = getStateForPathRename({
        oldPath: path,
        newPath,
        recentNotes,
        displayNames,
        noteContentsCache,
      });
      if (nextRecentNotes !== recentNotes) {
        persistRecentNotes(nextRecentNotes);
      }

      set({
        starredEntries: updatedStarredEntries,
        starredFolders: updatedStarredFolders,
        starredNotes: updatedStarredNotes,
        noteMetadata: updatedMetadata ?? noteMetadata,
        recentNotes: nextRecentNotes,
        displayNames: nextDisplayNames,
        noteContentsCache: nextNoteContentsCache,
      });

      if (rootFolder) {
        const updatedChildren = updateFolderNode(rootFolder.children, path, resolvedFolderName, newPath);
        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          updatedChildren,
          fileTreeSortMode,
          updatedMetadata ?? noteMetadata
        );
        set({
          rootFolder: nextRootFolder,
          openTabs: updatedTabs,
          currentNote: updatedCurrentNote,
        });
        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: updatedCurrentNote?.path ?? null,
          fileTreeSortMode,
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
    }
  },

  createFolder: async (parentPath: string, name?: string) => {
    let { notesPath, fileTreeSortMode, noteMetadata } = get();
    const storage = getStorageAdapter();

    try {
      if (!notesPath) {
        notesPath = await getNotesBasePath();
        await ensureNotesFolder(notesPath);
        set({ notesPath });
      }

      const {
        relativePath: folderPath,
        fullPath,
        fileName: folderName,
      } = await resolveUniquePath(notesPath, parentPath || undefined, name || 'Untitled', true);

      markExpectedExternalChange(fullPath, true);
      await storage.mkdir(fullPath, true);

      const newNode: any = {
        id: folderPath,
        name: folderName,
        path: folderPath,
        isFolder: true,
        children: [],
        expanded: false
      };

      const currentRootFolder = ensureRootFolderState(get().rootFolder);
      const nextRootFolder = buildSortedRootFolder(
        currentRootFolder,
        addNodeToTree(currentRootFolder.children, parentPath, newNode),
        fileTreeSortMode,
        noteMetadata
      );
      set({
        rootFolder: nextRootFolder,
        newlyCreatedFolderPath: !name ? folderPath : null,
      });
      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: get().currentNote?.path ?? null,
        fileTreeSortMode,
      });
      return folderPath;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create folder' });
      return null;
    }
  },

  clearNewlyCreatedFolder: () => set({ newlyCreatedFolderPath: null }),

  deleteFolder: async (path: string) => {
    const {
      notesPath,
      rootFolder,
      currentNote,
      openTabs,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
      noteContentsCache,
      recentNotes,
      displayNames,
    } = get();
    try {
        const result = await deleteFolderImpl(
            notesPath, path,
            { rootFolder, currentNote, openTabs, starredEntries, noteMetadata }
        );

        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = getStateForPathDeletion({
          path,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        if (nextRecentNotes !== recentNotes) {
          persistRecentNotes(nextRecentNotes);
        }

        set({
            starredEntries: result.updatedStarredEntries,
            starredFolders: result.updatedStarredFolders,
            starredNotes: result.updatedStarredNotes,
            openTabs: result.updatedTabs,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteMetadata: result.updatedMetadata ?? noteMetadata,
            noteContentsCache: nextNoteContentsCache,
        });

        if (currentNote && isPathWithinFolder(currentNote.path, path)) {
          set({ currentNote: null, isDirty: false });
        }

        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.newChildren,
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata
        );
        if (nextRootFolder) {
          set({ rootFolder: nextRootFolder });
        }

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath:
            result.nextAction?.path ??
            (currentNote && isPathWithinFolder(currentNote.path, path) ? null : currentNote?.path ?? null),
          fileTreeSortMode,
        });

        if (result.nextAction && result.nextAction.type === 'open') {
          await get().openNote(result.nextAction.path);
        }
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete folder' });
    }
  },

  moveItem: async (sourcePath: string, targetFolderPath: string) => {
    const {
      notesPath,
      rootFolder,
      currentNote,
      openTabs,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
      noteContentsCache,
      recentNotes,
      displayNames,
    } = get();
    try {
        if (isInvalidMoveTarget(sourcePath, targetFolderPath)) {
          return;
        }

        const result = await moveItemImpl(
            notesPath, sourcePath, targetFolderPath,
            { rootFolder, currentNote, openTabs, starredEntries, noteMetadata }
        );

        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = getStateForPathRename({
          oldPath: result.sourcePath,
          newPath: result.newPath,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        if (nextRecentNotes !== recentNotes) {
          persistRecentNotes(nextRecentNotes);
        }

        set({
            starredEntries: result.updatedStarredEntries,
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
            noteMetadata: result.updatedMetadata ?? noteMetadata,
            openTabs: result.updatedTabs,
            currentNote: result.nextCurrentNote,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteContentsCache: nextNoteContentsCache,
        });

        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.newChildren,
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata
        );
        if (nextRootFolder) {
          set({ rootFolder: nextRootFolder });
        }
        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: result.nextCurrentNote?.path ?? null,
          fileTreeSortMode,
        });
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to move item' });
    }
  },

  uploadNoteAsset: async (_notePath: string, file: File): Promise<string | null> => {
    const { notesPath } = get();
    return uploadNoteAssetImpl(notesPath, file);
  },

  setFileTreeSortMode: async (mode) => {
    const { rootFolder, noteMetadata, notesPath, currentNote, fileTreeSortMode } = get();
    if (mode === fileTreeSortMode) {
      return;
    }

    const nextChildren = rootFolder
      ? sortNestedFileTree(rootFolder.children, {
          mode,
          metadata: noteMetadata,
        })
      : null;

    set({
      fileTreeSortMode: mode,
      rootFolder: rootFolder && nextChildren ? { ...rootFolder, children: nextChildren } : rootFolder,
    });

    persistWorkspaceSnapshot(notesPath, {
      rootFolder: rootFolder && nextChildren ? { ...rootFolder, children: nextChildren } : rootFolder,
      currentNotePath: currentNote?.path || null,
      fileTreeSortMode: mode,
    });
  },
});
