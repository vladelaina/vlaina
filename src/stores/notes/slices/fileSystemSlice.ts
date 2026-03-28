import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { NotesStore } from '../types';
import {
  buildFileTree,
  updateFolderExpanded,
  updateFolderNode,
  collectExpandedPaths,
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
  saveWorkspaceState,
} from '../storage';
import { getVaultStarredPaths } from '../starred';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { processFolderRename } from '../utils/fs/batchOperations';
import { deleteNoteImpl, deleteFolderImpl } from '../utils/fs/deleteOperations';
import { resolveUniquePath, resolveUniqueRenamedPath } from '../utils/fs/pathOperations';
import { renameNoteImpl, moveItemImpl } from '../utils/fs/renameOperations';
import { uploadNoteAssetImpl } from '../utils/fs/uploadOperations';

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

    if (notesPath) {
      const expandedPaths = collectExpandedPaths(updatedChildren);
      const { currentNote } = get();
      saveWorkspaceState(notesPath, {
        currentNotePath: currentNote?.path || null,
        expandedFolders: Array.from(expandedPaths),
        fileTreeSortMode,
      });
    }
  },

  revealFolder: (path: string) => {
    const { rootFolder, notesPath, currentNote, fileTreeSortMode } = get();
    if (!rootFolder) return;

    const updatedChildren = expandFoldersForPath(rootFolder.children, path);
    set({ rootFolder: { ...rootFolder, children: updatedChildren } });

    if (notesPath) {
      const expandedPaths = collectExpandedPaths(updatedChildren);
      saveWorkspaceState(notesPath, {
        currentNotePath: currentNote?.path || null,
        expandedFolders: Array.from(expandedPaths),
        fileTreeSortMode,
      });
    }
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
    } = get();

    if (isDirty) {
      await saveNote();
      if (get().isDirty) {
        throw new Error('Failed to save current note before creating a new note');
      }
      ({ openTabs, recentNotes, rootFolder, currentNote } = get());
    }
    
    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }

    try {
      const { 
          relativePath, 
          fileName, 
          updatedMetadata, 
          newChildren, 
          updatedRecent 
      } = await createNoteImpl(notesPath, folderPath, undefined, '', { rootFolder, recentNotes });

      if (rootFolder) {
        set({
          rootFolder: {
            ...rootFolder,
            children: sortNestedFileTree(newChildren, {
              mode: fileTreeSortMode,
              metadata: updatedMetadata,
            }),
          },
          noteMetadata: updatedMetadata,
        });
      }

      const tabName = getNoteTitleFromPath(fileName);
      const newTab = { path: relativePath, name: tabName, isDirty: false };
      
      let updatedTabs = openTabs;
      if (currentNote?.path) {
        updatedTabs = openTabs.map(t => t.path === currentNote.path ? newTab : t);
      } else {
        updatedTabs = [...openTabs, newTab];
      }

      set({
        currentNote: { path: relativePath, content: '' },
        isDirty: false,
        openTabs: updatedTabs,
        recentNotes: updatedRecent,
        isNewlyCreated: true,
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
    } = get();
    const storage = getStorageAdapter();

    if (isDirty) {
      await saveNote();
      if (get().isDirty) {
        throw new Error('Failed to save current note before creating a new note');
      }
      ({ rootFolder, recentNotes, openTabs, currentNote } = get());
    }

    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }

    try {
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
      } = await createNoteImpl(notesPath, folderPath, name, content, { rootFolder, recentNotes });

      if (rootFolder) {
        set({
          rootFolder: {
            ...rootFolder,
            children: sortNestedFileTree(newChildren, {
              mode: fileTreeSortMode,
              metadata: updatedMetadata,
            }),
          },
          noteMetadata: updatedMetadata,
        });
      }

      const tabName = getNoteTitleFromPath(fileName);
      let updatedTabs = openTabs;
      
      if (currentNote?.path) {
        updatedTabs = openTabs.map(t => t.path === currentNote.path ? { path: relativePath, name: tabName, isDirty: false } : t);
      } else {
        updatedTabs = [...openTabs, { path: relativePath, name: tabName, isDirty: false }];
      }

      set({
        currentNote: { path: relativePath, content },
        isDirty: false,
        recentNotes: updatedRecent,
        openTabs: updatedTabs
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
      starredNotes,
      starredFolders,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
    } = get();
    try {
        const result = await deleteNoteImpl(
          notesPath,
          path,
          { rootFolder, currentNote, openTabs, starredNotes, starredFolders, starredEntries },
          set
        );
        
        set({ 
            openTabs: result.updatedTabs,
            starredEntries: result.updatedStarredEntries,
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
        });

        if (rootFolder) {
            set({
              rootFolder: {
                ...rootFolder,
                children: sortNestedFileTree(result.newChildren, {
                  mode: fileTreeSortMode,
                  metadata: noteMetadata,
                }),
              },
            });
        }

        if (result.nextAction && result.nextAction.type === 'open') {
            await get().openNote(result.nextAction.path);
        } else if (result.nextCurrentNote === null) {
            set({ currentNote: null, isDirty: false });
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
      starredNotes,
      starredFolders,
      starredEntries,
      noteMetadata,
      fileTreeSortMode,
    } = get();
    try {
        const result = await renameNoteImpl(
            notesPath, path, newName, 
            { rootFolder, currentNote, openTabs, starredNotes, starredFolders, starredEntries, noteMetadata },
            set
        );

        if (!result) return;

        set({
            starredEntries: result.updatedStarredEntries,
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
            noteMetadata: result.updatedMetadata,
            openTabs: result.updatedTabs,
            currentNote: result.nextCurrentNote
        });

        if (rootFolder) {
            set({
              rootFolder: {
                ...rootFolder,
                children: sortNestedFileTree(result.updatedChildren, {
                  mode: fileTreeSortMode,
                  metadata: result.updatedMetadata,
                }),
              },
            });
        }
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
      starredNotes,
      starredFolders,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
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
        { starredFolders, starredNotes, starredEntries, openTabs, currentNote, noteMetadata },
        set
      );

      set({
        starredEntries: updatedStarredEntries,
        starredFolders: updatedStarredFolders,
        starredNotes: updatedStarredNotes,
        noteMetadata: updatedMetadata ?? noteMetadata,
      });

      if (rootFolder) {
        const updatedChildren = updateFolderNode(rootFolder.children, path, resolvedFolderName, newPath);
        set({
          rootFolder: {
            ...rootFolder,
            children: sortNestedFileTree(updatedChildren, {
              mode: fileTreeSortMode,
              metadata: updatedMetadata ?? noteMetadata,
            }),
          },
          openTabs: updatedTabs,
          currentNote: updatedCurrentNote,
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
    }
  },

  createFolder: async (parentPath: string, name?: string) => {
    const { notesPath, fileTreeSortMode, noteMetadata } = get();
    const storage = getStorageAdapter();

    try {
      const {
        relativePath: folderPath,
        fullPath,
        fileName: folderName,
      } = await resolveUniquePath(notesPath, parentPath || undefined, name || 'Untitled', true);

      await storage.mkdir(fullPath, true);

      const newNode: any = {
        id: folderPath,
        name: folderName,
        path: folderPath,
        isFolder: true,
        children: [],
        expanded: false
      };

      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: sortNestedFileTree(
              addNodeToTree(currentRootFolder.children, parentPath, newNode),
              {
                mode: fileTreeSortMode,
                metadata: noteMetadata,
              }
            ),
          },
          newlyCreatedFolderPath: !name ? folderPath : null,
        });
      }
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
      starredNotes,
      starredFolders,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
    } = get();
    try {
        const result = await deleteFolderImpl(
            notesPath, path,
            { rootFolder, currentNote, openTabs, starredNotes, starredFolders, starredEntries },
            set,
            (p) => get().openNote(p)
        );

        set({
            starredEntries: result.updatedStarredEntries,
            starredFolders: result.updatedStarredFolders,
            starredNotes: result.updatedStarredNotes,
            openTabs: result.updatedTabs,
        });

        if (result.updatedCurrentNote !== undefined) { // Could be null
             if (result.updatedCurrentNote === null && currentNote !== null) {
                 set({ currentNote: null, isDirty: false });
             } else if (result.updatedCurrentNote) {
                 set({ currentNote: result.updatedCurrentNote });
             }
        }

        if (rootFolder) {
            set({
              rootFolder: {
                ...rootFolder,
                children: sortNestedFileTree(result.newChildren, {
                  mode: fileTreeSortMode,
                  metadata: noteMetadata,
                }),
              },
            });
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
      starredNotes,
      starredFolders,
      starredEntries,
      fileTreeSortMode,
      noteMetadata,
    } = get();
    try {
        const result = await moveItemImpl(
            notesPath, sourcePath, targetFolderPath,
            { rootFolder, currentNote, openTabs, starredNotes, starredFolders, starredEntries, noteMetadata },
            set
        );

        set({
            starredEntries: result.updatedStarredEntries,
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
            noteMetadata: result.updatedMetadata ?? noteMetadata,
            openTabs: result.updatedTabs,
            currentNote: result.nextCurrentNote
        });

        if (rootFolder) {
            set({
              rootFolder: {
                ...rootFolder,
                children: sortNestedFileTree(result.newChildren, {
                  mode: fileTreeSortMode,
                  metadata: result.updatedMetadata ?? noteMetadata,
                }),
              },
            });
        }
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

    if (notesPath) {
      saveWorkspaceState(notesPath, {
        currentNotePath: currentNote?.path || null,
        expandedFolders: nextChildren ? Array.from(collectExpandedPaths(nextChildren)) : [],
        fileTreeSortMode: mode,
      });
    }
  },
});
