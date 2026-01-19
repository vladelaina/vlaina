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
  addNodeToTree,
  removeNodeFromTree,
  findNode,
  deepUpdateNodePath,
} from '../fileTreeUtils';
import {
  getNotesBasePath,
  ensureNotesFolder,
  loadNoteMetadata,
  saveNoteMetadata,
  setNoteEntry,
  loadWorkspaceState,
  loadFavoritesFromFile,
  saveWorkspaceState,
  saveFavoritesToFile,
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
        noteMetadata: metadata,
        starredNotes: favorites.notes,
        starredFolders: favorites.folders,
        isLoading: false,
      });

      // Restore last opened note
      // skipRestore is used when we want to manually handle navigation (e.g. after creating a new note)
      if (!skipRestore && workspace?.currentNotePath) {
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
    let { notesPath, openTabs, recentNotes } = get();
    const storage = getStorageAdapter();

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

      const defaultContent = '';
      await safeWriteTextFile(fullPath, defaultContent);

      // Initialize Metadata
      const now = Date.now();
      const metadata = await loadNoteMetadata(notesPath);
      const updatedMetadata = setNoteEntry(metadata, relativePath, {
        createdAt: now,
        updatedAt: now,
      });
      await saveNoteMetadata(notesPath, updatedMetadata);

      // Optimistic Update: Add to tree without reloading
      const newNode: any = { // fileTreeUtils types might need export, using any for safety momentarily or import FileTreeNode
        id: relativePath,
        name: fileName.replace('.md', ''),
        path: relativePath,
        isFolder: false
      };

      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: addNodeToTree(currentRootFolder.children, folderPath, newNode),
          },
          noteMetadata: updatedMetadata, // Update store
        });
      }

      const tabName = fileName.replace('.md', '');

      // Update Tabs: Replace current tab if exists, otherwise append
      // This mimics Apple Notes behavior (single view context)
      let updatedTabs = openTabs;
      const newTab = { path: relativePath, name: tabName, isDirty: false };

      const currentNotePath = get().currentNote?.path;
      if (currentNotePath) {
        updatedTabs = openTabs.map(t => t.path === currentNotePath ? newTab : t);
      } else {
        updatedTabs = [...openTabs, newTab];
      }

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
    let { notesPath, /* rootFolder, */ recentNotes, openTabs } = get();
    const storage = getStorageAdapter();

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

      // Initialize Metadata
      const now = Date.now();
      const metadata = await loadNoteMetadata(notesPath);
      const updatedMetadata = setNoteEntry(metadata, relativePath, {
        createdAt: now,
        updatedAt: now,
      });
      await saveNoteMetadata(notesPath, updatedMetadata);

      // Optimistic Update
      const newNode: any = {
        id: relativePath,
        name: fileName.replace('.md', ''),
        path: relativePath,
        isFolder: false
      };

      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: addNodeToTree(currentRootFolder.children, folderPath, newNode),
          },
          noteMetadata: updatedMetadata,
        });
      }

      // Update recent notes
      const updatedRecent = addToRecentNotes(relativePath, recentNotes); // Use fresh recentNotes

      // Since this is specific "Create Note With Content", we assume it might be a paste or import.
      // We will KEEP standard tab behavior (append) if it creates implicit content? 
      // User requested "Create New File" flow improvement. This function is likely used by "+ Create" button too if name provided.
      // But standard "+" button uses createNote().
      // Let's safe-guard this one to also reuse tab if it was triggered from a similar context.
      // Actually, createNoteWithContent is likely drag-drop or specialized. I'll stick to Reuse logic for consistency.

      let updatedTabs = openTabs;  // Start with current
      // Reuse logic
      const currentNotePath = get().currentNote?.path;
      if (currentNotePath) {
        const tabName = name.replace('.md', '');
        updatedTabs = openTabs.map(t => t.path === currentNotePath ? { path: relativePath, name: tabName, isDirty: false } : t);
      } else {
        const tabName = name.replace('.md', '');
        updatedTabs = [...openTabs, { path: relativePath, name: tabName, isDirty: false }];
      }

      set({
        currentNote: { path: relativePath, content },
        isDirty: false,
        recentNotes: updatedRecent,
        noteMetadata: updatedMetadata,
        // Also update openTabs here, it was missing in original code? 
        // Wait, original code did NOT update openTabs in createNoteWithContent. 
        // It just set currentNote. This means it relied on openTabs not changing?
        // Or createNoteWithContent wasn't opening it?
        // Line 261: set({ currentNote: ... }). The store implies that currentNote should be in tabs?
        // If I strictly follow the Apple design, I should ensure it's in a tab.
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
      currentNote,
      openTabs,
      starredNotes,
      starredFolders,
    } = get();
    const storage = getStorageAdapter();

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

      // Optimistic Update: Remove from tree without reloading
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: removeNodeFromTree(currentRootFolder.children, path),
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
      noteMetadata,
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

      // Update metadata if exists (move icon and cover from old path to new path)
      if (noteMetadata?.notes[path]) {
        const entry = noteMetadata.notes[path];
        const { [path]: _, ...restNotes } = noteMetadata.notes;
        const updated = {
          ...noteMetadata,
          notes: { ...restNotes, [newPath]: entry },
        };
        set({ noteMetadata: updated });
        saveNoteMetadata(notesPath, updated);
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

      // Optimistic Update
      const newNode: any = { // Using any momentarily to satisfy type if strict
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
    const { notesPath, currentNote, openTabs, starredNotes, starredFolders } = get();
    const storage = getStorageAdapter();

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

      // Update open tabs: close any tabs that were inside the deleted folder
      const updatedTabs = openTabs.filter((tab) => !tab.path.startsWith(path + '/') && tab.path !== path);

      // If the current note was inside the deleted folder, clear it
      let updatedCurrentNote = currentNote;
      if (currentNote && (currentNote.path === path || currentNote.path.startsWith(path + '/'))) {
        if (updatedTabs.length > 0) {
          const lastTab = updatedTabs[updatedTabs.length - 1];
          // Open the last remaining tab
          get().openNote(lastTab.path); // This will also set currentNote and openTabs
          updatedCurrentNote = null; // openNote will handle setting currentNote
        } else {
          updatedCurrentNote = null;
          set({ currentNote: null, isDirty: false });
        }
      }

      // Remove display names for all items in the deleted folder
      removeDisplayName(set, path); // This function should handle recursive removal if path is a folder

      // Optimistic Update: Remove from tree
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        set({
          rootFolder: {
            ...currentRootFolder,
            children: removeNodeFromTree(currentRootFolder.children, path),
          },
          openTabs: updatedTabs,
          currentNote: updatedCurrentNote !== null ? updatedCurrentNote : get().currentNote, // Ensure currentNote is updated if it was cleared
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
      openTabs,
      starredNotes,
      starredFolders,
    } = get();
    const storage = getStorageAdapter();

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

      // Optimistic Update: Move node in tree
      const currentRootFolder = get().rootFolder;
      if (currentRootFolder) {
        const nodeToMove = findNode(currentRootFolder.children, sourcePath);
        if (nodeToMove) {
          // 1. Prepare new node with updated paths
          const nodeWithNewPath = deepUpdateNodePath(nodeToMove, sourcePath, newPath);
          const updatedNode = { ...nodeWithNewPath, name: fileName.replace('.md', '') };

          // 2. Remove from old location
          const childrenWithoutNode = removeNodeFromTree(currentRootFolder.children, sourcePath);

          // 3. Add to new location
          const newChildren = addNodeToTree(childrenWithoutNode, targetFolderPath, updatedNode);

          set({
            rootFolder: {
              ...currentRootFolder,
              children: newChildren,
            },
          });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to move item' });
    }
  },

  uploadNoteAsset: async (_notePath: string, file: File): Promise<string | null> => {
    const { notesPath } = get();
    const storage = getStorageAdapter();

    try {
      // confirm vault path
      const vaultPath = notesPath || await getNotesBasePath();

      // Ensure .nekotick/assets/covers directory exists
      const assetsDir = await joinPath(vaultPath, '.nekotick', 'assets', 'covers');
      if (!await storage.exists(assetsDir)) {
        await storage.mkdir(assetsDir, true);
      }

      // Generate unique filename
      // Format: cover-[timestamp]-[random].ext
      const ext = file.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const fileName = `cover-${timestamp}-${random}.${ext}`;

      const fullPath = await joinPath(assetsDir, fileName);

      // Convert File to Uint8Array
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // Write binary file
      await storage.writeBinaryFile(fullPath, uint8Array);

      // Return only filename
      return fileName;

    } catch (error) {
      console.error('Failed to upload asset:', error);
      set({ error: error instanceof Error ? error.message : 'Failed to upload asset' });
      return null;
    }
  },
});
