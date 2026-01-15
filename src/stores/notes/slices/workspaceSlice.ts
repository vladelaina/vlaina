/**
 * Workspace Slice - Current note, tabs, and workspace state management
 */

import { StateCreator } from 'zustand';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { NotesStore } from '../types';
import { updateDisplayName, removeDisplayName } from '../displayNameUtils';
import {
  addToRecentNotes,
  saveFavoritesToFile,
  saveWorkspaceState,
  safeWriteTextFile,
  loadNoteMetadata,
  saveNoteMetadata,
  setNoteEntry,
} from '../storage';
import { collectExpandedPaths, restoreExpandedState } from '../fileTreeUtils';

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
    const { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote } = get();
    if (isDirty) await saveNote();

    try {
      const storage = getStorageAdapter();
      const fullPath = await joinPath(notesPath, path);
      const content = await storage.readFile(fullPath);
      // Use filename as tab name, not H1
      const fileName = path.split('/').pop()?.replace('.md', '') || 'Untitled';
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
      });

      // Save workspace state
      const { rootFolder } = get();
      if (notesPath && rootFolder) {
        const expandedPaths = collectExpandedPaths(rootFolder.children);
        saveWorkspaceState(notesPath, {
          currentNotePath: path,
          expandedFolders: Array.from(expandedPaths),
        });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  // Open a note using absolute path (for GitHub repos and external files)
  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    const { isDirty, saveNote, openTabs, currentNote } = get();
    if (isDirty) await saveNote();

    try {
      const storage = getStorageAdapter();
      const content = await storage.readFile(absolutePath);

      // Use the absolute path as the identifier
      const fileName = absolutePath.split(/[/\\]/).pop()?.replace('.md', '') || 'Untitled';
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
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  saveNote: async () => {
    const { currentNote, notesPath } = get();
    if (!currentNote) return;

    try {
      // Check if path is absolute (starts with drive letter on Windows or / on Unix)
      const isAbsolutePath = /^[A-Za-z]:[\\/]/.test(currentNote.path) || currentNote.path.startsWith('/');
      const fullPath = isAbsolutePath
        ? currentNote.path
        : await joinPath(notesPath, currentNote.path);

      await safeWriteTextFile(fullPath, currentNote.content);

      // Update modification time
      const metadata = await loadNoteMetadata(notesPath);
      const updatedMetadata = setNoteEntry(metadata, currentNote.path, {
        updatedAt: Date.now(),
      });
      await saveNoteMetadata(notesPath, updatedMetadata);

      // Update store with new metadata
      set({
        isDirty: false,
        noteMetadata: updatedMetadata
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save note' });
    }
  },

  updateContent: (content: string) => {
    const { currentNote } = get();
    if (!currentNote || currentNote.content === content) return;
    set({ currentNote: { ...currentNote, content }, isDirty: true });
  },

  closeNote: () => set({ currentNote: null, isDirty: false }),

  closeTab: async (path: string) => {
    const {
      openTabs,
      currentNote,
      isDirty,
      saveNote,
      notesPath,
      loadFileTree,
      rootFolder,
      starredNotes,
      starredFolders,
    } = get();

    // Helper to check if path is absolute
    const isAbsolutePath = (p: string) => /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/');
    const pathIsAbsolute = isAbsolutePath(path);

    const { isNewlyCreated } = get();
    // Check if the note is empty and newly created (only for local workspace files)
    const isEmptyNote =
      !pathIsAbsolute &&
      isNewlyCreated &&
      currentNote?.path === path &&
      (!currentNote.content.trim() ||
        currentNote.content.trim() === '#' ||
        currentNote.content.trim() === '# ' ||
        currentNote.content.trim().length === 0);

    if (isEmptyNote) {
      try {
        const storage = getStorageAdapter();
        const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
        const fullPath = await joinPath(notesPath, path);
        await storage.deleteFile(fullPath);
        removeDisplayName(set, path);

        // Remove from favorites if starred
        if (starredNotes.includes(path)) {
          const updatedStarred = starredNotes.filter((p) => p !== path);
          set({ starredNotes: updatedStarred });
          saveFavoritesToFile(notesPath, { notes: updatedStarred, folders: starredFolders });
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
      } catch {
        /* ignore */
      }
    } else if (currentNote?.path === path && isDirty) {
      await saveNote();
    }

    const updatedTabs = openTabs.filter((t) => t.path !== path);
    set({ openTabs: updatedTabs });

    if (currentNote?.path === path) {
      if (updatedTabs.length > 0) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        // Use appropriate open method based on path type
        if (isAbsolutePath(lastTab.path)) {
          get().openNoteByAbsolutePath(lastTab.path);
        } else {
          get().openNote(lastTab.path);
        }
      } else {
        set({ currentNote: null, isDirty: false });
        // Clear workspace current note when no tabs (only for local workspace)
        if (notesPath && rootFolder) {
          const expandedPaths = collectExpandedPaths(rootFolder.children);
          saveWorkspaceState(notesPath, {
            currentNotePath: null,
            expandedFolders: Array.from(expandedPaths),
          });
        }
      }
    }
  },

  switchTab: (path: string) => {
    // Check if path is absolute (GitHub repo files use absolute paths)
    const isAbsolutePath = /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/');
    if (isAbsolutePath) {
      get().openNoteByAbsolutePath(path);
    } else {
      get().openNote(path);
    }
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const { openTabs } = get();
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      fromIndex >= openTabs.length ||
      toIndex < 0 ||
      toIndex >= openTabs.length
    )
      return;

    const updatedTabs = [...openTabs];
    const [movedTab] = updatedTabs.splice(fromIndex, 1);
    updatedTabs.splice(toIndex, 0, movedTab);
    set({ openTabs: updatedTabs });
  },

  syncDisplayName: (path: string, title: string) => updateDisplayName(set, path, title),

  getDisplayName: (path: string) => {
    const state = get();
    return state.displayNames.get(path) || path.split('/').pop()?.replace('.md', '') || 'Untitled';
  },
});
