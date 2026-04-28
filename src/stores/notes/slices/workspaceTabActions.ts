import { isAbsolutePath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { updateDisplayName } from '../displayNameUtils';
import { resolveDraftNoteTitle } from '../draftNote';
import { openStoredNotePath } from '../openNotePath';
import { removeCachedNoteContent } from '../document/noteContentCache';
import {
  pushRecentlyClosedTab,
  restoreClosedTabOrder,
} from '../document/recentlyClosedTabState';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';

type WorkspaceTabActions = Pick<
  WorkspaceSlice,
  | 'updateDraftNoteName'
  | 'discardDraftNote'
  | 'cancelPendingDraftDiscard'
  | 'confirmPendingDraftDiscard'
  | 'closeNote'
  | 'closeTab'
  | 'reopenClosedTab'
  | 'switchTab'
  | 'reorderTabs'
  | 'syncDisplayName'
  | 'getDisplayName'
>;

export function createWorkspaceTabActions(set: NotesSet, get: NotesGet): WorkspaceTabActions {
  return {
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
        const reopened =
          nextState.currentNote?.path === entry.tab.path &&
          nextState.openTabs.some((tab) => tab.path === entry.tab.path);
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
  };
}
