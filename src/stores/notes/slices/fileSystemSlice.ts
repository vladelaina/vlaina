/**
 * FileSystem Slice - File and folder operations
 */

import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import {
  buildFileTree,
  sortFileTree,
  updateFolderExpanded,
  updateFolderNode,
  updateFileNodePath,
  collectExpandedPaths,
  restoreExpandedState,
} from '../fileTreeUtils';
import {
  getNotesBasePath,
  ensureNotesFolder,
  loadNoteIconsFromFile,
  loadWorkspaceState,
  loadFavoritesFromFile,
  saveWorkspaceState,
  saveFavoritesToFile,
  saveNoteIconsToFile,
  safeWriteTextFile,
  addToRecentNotes,
} from '../storage';
import { moveDisplayName, removeDisplayName, updateDisplayName } from '../displayNameUtils';
import { sanitizeFileName } from '../noteUtils';

export interface FileSystemSlice {
  rootFolder: NotesStore['rootFolder'];
  notesPath: NotesStore['notesPath'];
  isNewlyCreated: NotesStore['isNewlyCreated'];
  newlyCreatedFolderPath: NotesStore['newlyCreatedFolderPath'];

  loadFileTree: () => Promise<void>;
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
}

export const createFileSystemSlice: StateCreator<NotesStore, [], [], FileSystemSlice> = (
  set,
  get
) => ({
  rootFolder: null,
  notesPath: '',
  isNewlyCreated: false,
  newlyCreatedFolderPath: null,

  loadFileTree: async () => {
    set({ isLoading: true, error: null });
    try {
      const storage = getStorageAdapter();
      const basePath = await getNotesBasePath();

      await ensureNotesFolder(basePath);
      const children = await buildFileTree(basePath);
      const icons = await loadNoteIconsFromFile(basePath);
      const workspace = await loadWorkspaceState(basePath);
      const favorites = await loadFavoritesFromFile(basePath);

      // Restore expanded folders from workspace state
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
        noteIcons: icons,
        starredNotes: favorites.notes,
        starredFolders: favorites.folders,
        isLoading: false,
      });

      // Restore last opened note
      if (workspace?.currentNotePath) {
        setTimeout(async () => {
          try {
            const fullPath = await joinPath(basePath, workspace.currentNotePath!);
            const fileExists = await storage.exists(fullPath);
            if (fileExists) {
              get().openNote(workspace.currentNotePath!);
            }
          } catch {
            // File no longer exists, ignore
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

    // Save expanded state
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
    let { notesPath, loadFileTree, openTabs, recentNotes, rootFolder } = get();
    const storage = getStorageAdapter();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();

    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }

    try {
      let counter = 1;
      let fileName = 'Untitled.md';
      let relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      let fullPath = await joinPath(notesPath, relativePath);

      while (await storage.exists(fullPath)) {
        fileName = `Untitled ${counter}.md`;
        relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
        fullPath = await joinPath(notesPath, relativePath);
        counter++;
      }

      const defaultContent = '# ';
      await safeWriteTextFile(fullPath, defaultContent);
      await loadFileTree();

      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }

      const tabName = fileName.replace('.md', '');
      const updatedTabs = [...openTabs, { path: relativePath, name: tabName, isDirty: false }];
      const updatedRecent = addToRecentNotes(relativePath, recentNotes);

      set({
        currentNote: { path: relativePath, content: defaultContent },
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
    let { notesPath, loadFileTree, rootFolder } = get();
    const storage = getStorageAdapter();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();

    if (!notesPath) {
      notesPath = await getNotesBasePath();
      await ensureNotesFolder(notesPath);
      set({ notesPath });
    }

    try {
      const fileName = name.endsWith('.md') ? name : `${name}.md`;
      const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const fullPath = await joinPath(notesPath, relativePath);

      if (folderPath) {
        const folderFullPath = await joinPath(notesPath, folderPath);
        const folderExists = await storage.exists(folderFullPath);
        if (!folderExists) await storage.mkdir(folderFullPath, true);
      }

      await safeWriteTextFile(fullPath, content);
      await loadFileTree();

      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }

      // Update recent notes
      const updatedRecent = addToRecentNotes(relativePath, get().recentNotes);

      set({
        currentNote: { path: relativePath, content },
        isDirty: false,
        recentNotes: updatedRecent,
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
      currentNote,
      loadFileTree,
      rootFolder,
      openTabs,
      starredNotes,
      starredFolders,
    } = get();
    const storage = getStorageAdapter();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();

    try {
      const fullPath = await joinPath(notesPath, path);
      await storage.deleteFile(fullPath);

      const updatedTabs = openTabs.filter((t) => t.path !== path);
      removeDisplayName(set, path);

      // Remove from favorites if starred
      if (starredNotes.includes(path)) {
        const updatedStarred = starredNotes.filter((p) => p !== path);
        set({ starredNotes: updatedStarred });
        saveFavoritesToFile(notesPath, { notes: updatedStarred, folders: starredFolders });
      }

      if (currentNote?.path === path) {
        if (updatedTabs.length > 0) {
          const lastTab = updatedTabs[updatedTabs.length - 1];
          set({ openTabs: updatedTabs });
          await get().openNote(lastTab.path);
        } else {
          set({ currentNote: null, isDirty: false, openTabs: updatedTabs });
        }
      } else {
        set({ openTabs: updatedTabs });
      }

      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
    }
  },

  renameNote: async (path: string, newName: string) => {
    const {
      notesPath,
      currentNote,
      rootFolder,
      openTabs,
      starredNotes,
      starredFolders,
      noteIcons,
    } = get();
    const storage = getStorageAdapter();

    try {
      const fullPath = await joinPath(notesPath, path);
      const dirPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '';
      const sanitizedName = sanitizeFileName(newName);
      const newFileName = sanitizedName.endsWith('.md') ? sanitizedName : `${sanitizedName}.md`;
      const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
      
      // Skip if path hasn't changed
      if (newPath === path) return;
      
      const newFullPath = await joinPath(notesPath, newPath);

      await storage.rename(fullPath, newFullPath);
      moveDisplayName(set, path, newPath);
      // Update display name with new filename
      updateDisplayName(set, newPath, sanitizedName.replace('.md', ''));

      // Update favorites if starred
      if (starredNotes.includes(path)) {
        const updatedStarred = starredNotes.map((p) => (p === path ? newPath : p));
        set({ starredNotes: updatedStarred });
        saveFavoritesToFile(notesPath, { notes: updatedStarred, folders: starredFolders });
      }

      // Update note icons if exists and save to file
      if (noteIcons.has(path)) {
        const icon = noteIcons.get(path);
        const updatedIcons = new Map(noteIcons);
        updatedIcons.delete(path);
        if (icon) updatedIcons.set(newPath, icon);
        set({ noteIcons: updatedIcons });
        // Save to config file
        saveNoteIconsToFile(notesPath, updatedIcons);
      }

      const updatedTabs = openTabs.map((tab) =>
        tab.path === path ? { ...tab, path: newPath, name: sanitizedName } : tab
      );

      // Update file tree directly without reloading
      if (rootFolder) {
        const updatedChildren = updateFileNodePath(
          rootFolder.children,
          path,
          newPath,
          sanitizedName
        );
        set({
          rootFolder: {
            ...rootFolder,
            children: updatedChildren,
          },
        });
      }

      if (currentNote?.path === path) {
        set({ currentNote: { ...currentNote, path: newPath }, openTabs: updatedTabs });
      } else {
        set({ openTabs: updatedTabs });
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

      // Update favorites paths
      const updatedStarredFolders = starredFolders.map((p) => {
        if (p === path) return newPath;
        if (p.startsWith(path + '/')) return p.replace(path, newPath);
        return p;
      });
      const updatedStarredNotes = starredNotes.map((p) => {
        if (p.startsWith(path + '/')) return p.replace(path, newPath);
        return p;
      });

      if (
        updatedStarredFolders.some((p, i) => p !== starredFolders[i]) ||
        updatedStarredNotes.some((p, i) => p !== starredNotes[i])
      ) {
        set({ starredFolders: updatedStarredFolders, starredNotes: updatedStarredNotes });
        saveFavoritesToFile(notesPath, {
          notes: updatedStarredNotes,
          folders: updatedStarredFolders,
        });
      }

      const updatedTabs = openTabs.map((tab) => {
        if (tab.path.startsWith(path + '/')) {
          const newTabPath = tab.path.replace(path, newPath);
          moveDisplayName(set, tab.path, newTabPath);
          return { ...tab, path: newTabPath };
        }
        return tab;
      });

      let updatedCurrentNote = currentNote;
      if (currentNote && currentNote.path.startsWith(path + '/')) {
        const newNotePath = currentNote.path.replace(path, newPath);
        moveDisplayName(set, currentNote.path, newNotePath);
        updatedCurrentNote = { ...currentNote, path: newNotePath };
      }

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
    const { notesPath, loadFileTree, rootFolder } = get();
    const storage = getStorageAdapter();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();

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
      if (parentPath) expandedPaths.add(parentPath);

      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
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
    const { notesPath, loadFileTree, rootFolder, starredNotes, starredFolders } = get();
    const storage = getStorageAdapter();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();

    try {
      const fullPath = await joinPath(notesPath, path);
      await storage.deleteDir(fullPath, true);

      // Remove folder and any notes inside from favorites
      const updatedStarredFolders = starredFolders.filter(
        (p) => p !== path && !p.startsWith(path + '/')
      );
      const updatedStarredNotes = starredNotes.filter((p) => !p.startsWith(path + '/'));

      if (
        updatedStarredFolders.length !== starredFolders.length ||
        updatedStarredNotes.length !== starredNotes.length
      ) {
        set({ starredFolders: updatedStarredFolders, starredNotes: updatedStarredNotes });
        saveFavoritesToFile(notesPath, {
          notes: updatedStarredNotes,
          folders: updatedStarredFolders,
        });
      }

      await loadFileTree();

      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
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
      currentNote,
      loadFileTree,
      rootFolder,
      openTabs,
      starredNotes,
      starredFolders,
    } = get();
    const storage = getStorageAdapter();
    const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();

    try {
      const fileName = sourcePath.split('/').pop() || '';
      const newPath = targetFolderPath ? `${targetFolderPath}/${fileName}` : fileName;
      const sourceFullPath = await joinPath(notesPath, sourcePath);
      const targetFullPath = await joinPath(notesPath, newPath);

      await storage.rename(sourceFullPath, targetFullPath);
      moveDisplayName(set, sourcePath, newPath);

      // Update favorites paths
      let favoritesChanged = false;
      const updatedStarredNotes = starredNotes.map((p) => {
        if (p === sourcePath || p.startsWith(sourcePath + '/')) {
          favoritesChanged = true;
          return p === sourcePath ? newPath : p.replace(sourcePath, newPath);
        }
        return p;
      });
      const updatedStarredFolders = starredFolders.map((p) => {
        if (p === sourcePath || p.startsWith(sourcePath + '/')) {
          favoritesChanged = true;
          return p === sourcePath ? newPath : p.replace(sourcePath, newPath);
        }
        return p;
      });

      if (favoritesChanged) {
        set({ starredNotes: updatedStarredNotes, starredFolders: updatedStarredFolders });
        saveFavoritesToFile(notesPath, {
          notes: updatedStarredNotes,
          folders: updatedStarredFolders,
        });
      }

      const updatedTabs = openTabs.map((tab) =>
        tab.path === sourcePath ? { ...tab, path: newPath } : tab
      );

      if (currentNote?.path === sourcePath) {
        set({ currentNote: { ...currentNote, path: newPath }, openTabs: updatedTabs });
      } else {
        set({ openTabs: updatedTabs });
      }

      await loadFileTree();
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: restoreExpandedState(currentRootFolder.children, expandedPaths),
          },
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to move item' });
    }
  },
});
