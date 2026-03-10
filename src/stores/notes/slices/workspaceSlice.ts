import { StateCreator } from 'zustand';
import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { useGithubReposStore } from '@/stores/useGithubReposStore';
import { isCloudNoteLogicalPath, parseCloudNoteLogicalPath } from '@/stores/cloudRepos';
import { NotesStore } from '../types';
import { updateDisplayName, removeDisplayName } from '../displayNameUtils';
import {
  addToRecentNotes,
  saveWorkspaceState,
  safeWriteTextFile,
  loadNoteMetadata,
  saveNoteMetadata,
  setNoteEntry,
} from '../storage';
import { collectExpandedPaths, restoreExpandedState } from '../fileTreeUtils';
import {
  getVaultStarredPaths,
  remapStarredEntriesForVault,
  saveStarredRegistry,
} from '../starred';
import { openStoredNotePath } from '../openNotePath';

export interface WorkspaceSlice {
  currentNote: NotesStore['currentNote'];
  isDirty: NotesStore['isDirty'];
  isLoading: NotesStore['isLoading'];
  error: NotesStore['error'];
  openTabs: NotesStore['openTabs'];
  displayNames: NotesStore['displayNames'];

  openNote: (path: string, openInNewTab?: boolean) => Promise<void>;
  openNoteByAbsolutePath: (absolutePath: string, openInNewTab?: boolean) => Promise<void>;
  openCloudNote: (
    note: {
      repositoryId: number;
      owner: string;
      repo: string;
      branch: string;
      relativePath: string;
      logicalPath: string;
      content: string;
      sha: string | null;
    },
    openInNewTab?: boolean
  ) => Promise<void>;
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
    if (isCloudNoteLogicalPath(path)) {
      const parsed = parseCloudNoteLogicalPath(path);
      if (!parsed) {
        set({ error: 'Failed to parse cloud note path' });
        return;
      }

      const snapshot = await useGithubReposStore
        .getState()
        .openRemoteNote(parsed.repositoryId, parsed.relativePath);

      if (!snapshot) {
        set({ error: 'Failed to open cloud note' });
        return;
      }

      await get().openCloudNote(snapshot, openInNewTab);
      return;
    }

    const { notesPath, isDirty, saveNote, recentNotes, openTabs, currentNote } = get();
    if (isDirty) {
      await saveNote();
      if (get().isDirty) return;
    }

    try {
      const storage = getStorageAdapter();
      const fullPath = await joinPath(notesPath, path);
      const content = await storage.readFile(fullPath);
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
        currentNote: { path, content, source: 'local' },
        isDirty: false,
        error: null,
        recentNotes: updatedRecent,
        openTabs: updatedTabs,
        isNewlyCreated: false,
      });

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

  openNoteByAbsolutePath: async (absolutePath: string, openInNewTab: boolean = false) => {
    const { isDirty, saveNote, openTabs, currentNote } = get();
    if (isDirty) {
      await saveNote();
      if (get().isDirty) return;
    }

    try {
      const storage = getStorageAdapter();
      const content = await storage.readFile(absolutePath);

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
        currentNote: { path: absolutePath, content, source: 'local' },
        isDirty: false,
        error: null,
        openTabs: updatedTabs,
        isNewlyCreated: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to open note' });
    }
  },

  openCloudNote: async (note, openInNewTab: boolean = false) => {
    const { isDirty, saveNote, openTabs, currentNote } = get();
    if (isDirty) {
      await saveNote();
      if (get().isDirty) return;
    }

    const tabName = getNoteTitleFromPath(note.relativePath);
    const existingTab = openTabs.find((tab) => tab.path === note.logicalPath);

    let updatedTabs = openTabs;
    if (existingTab) {
      updatedTabs = openTabs.map((tab) =>
        tab.path === note.logicalPath ? { ...tab, name: tabName } : tab
      );
    } else if (openInNewTab || openTabs.length === 0) {
      updatedTabs = [...openTabs, { path: note.logicalPath, name: tabName, isDirty: false }];
    } else {
      const currentTabIndex = openTabs.findIndex((tab) => tab.path === currentNote?.path);
      if (currentTabIndex !== -1) {
        updatedTabs = [...openTabs];
        updatedTabs[currentTabIndex] = {
          path: note.logicalPath,
          name: tabName,
          isDirty: false,
        };
      } else {
        updatedTabs = [...openTabs, { path: note.logicalPath, name: tabName, isDirty: false }];
      }
    }

    updateDisplayName(set, note.logicalPath, tabName);
    set({
      currentNote: {
        path: note.logicalPath,
        content: note.content,
        source: 'cloud',
        repositoryId: note.repositoryId,
        repositoryOwner: note.owner,
        repositoryName: note.repo,
        repositoryBranch: note.branch,
        remotePath: note.relativePath,
        remoteSha: note.sha,
      },
      isDirty: false,
      error: null,
      openTabs: updatedTabs,
      isNewlyCreated: false,
    });
  },

  saveNote: async () => {
    const { currentNote, notesPath } = get();
    if (!currentNote) return;

    if (currentNote.source === 'cloud') {
      if (
        !currentNote.repositoryId ||
        !currentNote.repositoryOwner ||
        !currentNote.repositoryName ||
        !currentNote.repositoryBranch ||
        !currentNote.remotePath
      ) {
        set({ error: 'Cloud note is missing repository context' });
        return;
      }

      try {
        await useGithubReposStore.getState().saveDraft({
          repositoryId: currentNote.repositoryId,
          owner: currentNote.repositoryOwner,
          repo: currentNote.repositoryName,
          branch: currentNote.repositoryBranch,
          relativePath: currentNote.remotePath,
          logicalPath: currentNote.path,
          content: currentNote.content,
          sha: currentNote.remoteSha ?? null,
        });
        set({ isDirty: false });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to save cloud draft' });
      }
      return;
    }

    try {
      const fullPath = isAbsolutePath(currentNote.path)
        ? currentNote.path
        : await joinPath(notesPath, currentNote.path);

      await safeWriteTextFile(fullPath, currentNote.content);

      const metadata = await loadNoteMetadata(notesPath);
      const updatedMetadata = setNoteEntry(metadata, currentNote.path, {
        updatedAt: Date.now(),
      });
      await saveNoteMetadata(notesPath, updatedMetadata);

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
      starredEntries,
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
      try {
        const storage = getStorageAdapter();
        const expandedPaths = rootFolder ? collectExpandedPaths(rootFolder.children) : new Set<string>();
        const fullPath = await joinPath(notesPath, path);
        await storage.deleteFile(fullPath);
        removeDisplayName(set, path);

        if (starredNotes.includes(path)) {
          const { entries: updatedEntries } = remapStarredEntriesForVault(
            starredEntries,
            notesPath,
            (relativePath, kind) => {
              if (kind !== 'note') return relativePath;
              return relativePath === path ? null : relativePath;
            }
          );
          const starredPaths = getVaultStarredPaths(updatedEntries, notesPath);
          set({
            starredEntries: updatedEntries,
            starredNotes: starredPaths.notes,
            starredFolders: starredPaths.folders,
          });
          void saveStarredRegistry(updatedEntries);
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
        console.error('[NotesWorkspace] Failed to cleanup empty note while closing tab:', error);
      }
    } else if (currentNote?.path === path && isDirty) {
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
    void openStoredNotePath(path, {
      openNote: get().openNote,
      openNoteByAbsolutePath: get().openNoteByAbsolutePath,
    });
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
    return state.displayNames.get(path) || getNoteTitleFromPath(path);
  },
});
