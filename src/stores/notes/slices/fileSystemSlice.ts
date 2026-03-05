import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import {
  buildFileTree,
  sortFileTree,
  updateFolderExpanded,
  updateFolderNode,
  collectExpandedPaths,
  restoreExpandedState,
  addNodeToTree,
} from '../fileTreeUtils';
import {
  getNotesBasePath,
  ensureNotesFolder,
  loadNoteMetadata,
  loadWorkspaceState,
  loadFavoritesFromFile,
  saveWorkspaceState,
} from '../storage';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { processFolderRename } from '../utils/fs/batchOperations';
import { deleteNoteImpl, deleteFolderImpl } from '../utils/fs/deleteOperations';
import { renameNoteImpl, moveItemImpl } from '../utils/fs/renameOperations';
import { uploadNoteAssetImpl } from '../utils/fs/uploadOperations';

export interface FileSystemSlice {
  rootFolder: NotesStore['rootFolder'];
  notesPath: NotesStore['notesPath'];
  isNewlyCreated: NotesStore['isNewlyCreated'];
  newlyCreatedFolderPath: NotesStore['newlyCreatedFolderPath'];

  loadFileTree: (skipRestore?: boolean) => Promise<void>;
  toggleFolder: (path: string) => void;
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
}

export const createFileSystemSlice: StateCreator<NotesStore, [], [], FileSystemSlice> = (
  set,
  get
) => ({
  rootFolder: null,
  notesPath: '',
  isNewlyCreated: false,
  newlyCreatedFolderPath: null,

  loadFileTree: async (skipRestore = false) => {
    set({ isLoading: true, error: null });
    try {
      const storage = getStorageAdapter();
      const basePath = await getNotesBasePath();

      await ensureNotesFolder(basePath);
      const children = await buildFileTree(basePath);
      const metadata = await loadNoteMetadata(basePath);
      const workspace = await loadWorkspaceState(basePath);
      const favorites = await loadFavoritesFromFile(basePath);

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
        starredNotes: favorites.notes,
        starredFolders: favorites.folders,
        isLoading: false,
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
    const { rootFolder, notesPath } = get();
    if (!rootFolder) return;
    const updatedChildren = updateFolderExpanded(rootFolder.children, path);
    set({ rootFolder: { ...rootFolder, children: updatedChildren } });

    if (notesPath) {
      const expandedPaths = collectExpandedPaths(updatedChildren);
      const { currentNote } = get();
      saveWorkspaceState(notesPath, {
        currentNotePath: currentNote?.path || null,
        expandedFolders: Array.from(expandedPaths),
      });
    }
  },

  createNote: async (folderPath?: string) => {
    let { notesPath, openTabs, recentNotes, rootFolder, currentNote, isDirty, saveNote } = get();

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
          rootFolder: { ...rootFolder, children: newChildren },
          noteMetadata: updatedMetadata,
        });
      }

      const tabName = fileName.replace('.md', '');
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
    let { notesPath, rootFolder, recentNotes, openTabs, currentNote, isDirty, saveNote } = get();
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
          rootFolder: { ...rootFolder, children: newChildren },
          noteMetadata: updatedMetadata,
        });
      }

      const tabName = fileName.replace('.md', '');
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
    const { notesPath, rootFolder, currentNote, openTabs, starredNotes, starredFolders } = get();
    try {
        const result = await deleteNoteImpl(notesPath, path, { rootFolder, currentNote, openTabs, starredNotes, starredFolders }, set);
        
        set({ 
            openTabs: result.updatedTabs, 
            starredNotes: result.updatedStarredNotes 
        });

        if (rootFolder) {
            set({ rootFolder: { ...rootFolder, children: result.newChildren } });
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
    const { notesPath, rootFolder, currentNote, openTabs, starredNotes, starredFolders, noteMetadata } = get();
    try {
        const result = await renameNoteImpl(
            notesPath, path, newName, 
            { rootFolder, currentNote, openTabs, starredNotes, starredFolders, noteMetadata }, 
            set
        );

        if (!result) return;

        set({
            starredNotes: result.updatedStarred,
            noteMetadata: result.updatedMetadata,
            openTabs: result.updatedTabs,
            currentNote: result.nextCurrentNote
        });

        if (rootFolder) {
            set({ rootFolder: { ...rootFolder, children: result.updatedChildren } });
        }
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
    }
  },

  renameFolder: async (path: string, newName: string) => {
    const { notesPath, rootFolder, currentNote, openTabs, starredNotes, starredFolders } = get();
    const storage = getStorageAdapter();

    try {
      const fullPath = await joinPath(notesPath, path);
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      const newPath = dirPath ? `${dirPath}/${newName}` : newName;
      const newFullPath = await joinPath(notesPath, newPath);

      await storage.rename(fullPath, newFullPath);

      const {
          updatedStarredFolders,
          updatedStarredNotes,
          updatedTabs,
          updatedCurrentNote
      } = await processFolderRename(notesPath, path, newName, { starredFolders, starredNotes, openTabs, currentNote }, set);

      set({ starredFolders: updatedStarredFolders, starredNotes: updatedStarredNotes });

      if (rootFolder) {
        const updatedChildren = updateFolderNode(rootFolder.children, path, newName, newPath);
        set({
          rootFolder: { ...rootFolder, children: sortFileTree(updatedChildren) },
          openTabs: updatedTabs,
          currentNote: updatedCurrentNote,
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
    }
  },

  createFolder: async (parentPath: string, name?: string) => {
    const { notesPath } = get();
    const storage = getStorageAdapter();

    try {
      let folderName = name || 'Untitled';
      let folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
      let fullPath = await joinPath(notesPath, folderPath);

      if (!name) {
        let counter = 1;
        while (await storage.exists(fullPath)) {
          folderName = `Untitled ${counter}`;
          folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
          fullPath = await joinPath(notesPath, folderPath);
          counter++;
        }
      }

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
            children: addNodeToTree(currentRootFolder.children, parentPath, newNode),
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
    const { notesPath, rootFolder, currentNote, openTabs, starredNotes, starredFolders } = get();
    try {
        const result = await deleteFolderImpl(
            notesPath, path,
            { rootFolder, currentNote, openTabs, starredNotes, starredFolders },
            set,
            (p) => get().openNote(p)
        );

        set({
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
            set({ rootFolder: { ...rootFolder, children: result.newChildren } });
        }
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete folder' });
    }
  },

  moveItem: async (sourcePath: string, targetFolderPath: string) => {
    const { notesPath, rootFolder, currentNote, openTabs, starredNotes, starredFolders } = get();
    try {
        const result = await moveItemImpl(
            notesPath, sourcePath, targetFolderPath,
            { rootFolder, currentNote, openTabs, starredNotes, starredFolders },
            set
        );

        set({
            starredNotes: result.updatedStarredNotes,
            starredFolders: result.updatedStarredFolders,
            openTabs: result.updatedTabs,
            currentNote: result.nextCurrentNote
        });

        if (rootFolder) {
            set({ rootFolder: { ...rootFolder, children: result.newChildren } });
        }
    } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to move item' });
    }
  },

  uploadNoteAsset: async (_notePath: string, file: File): Promise<string | null> => {
    const { notesPath } = get();
    return uploadNoteAssetImpl(notesPath, file);
  },
});
