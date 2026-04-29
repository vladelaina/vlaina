import { isAbsolutePath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { updateDisplayName } from '../displayNameUtils';
import { resolveDraftNoteTitle } from '../draftNote';
import { openStoredNotePath } from '../openNotePath';
import { removeCachedNoteContent, setCachedNoteContent } from '../document/noteContentCache';
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
      const {
        draftNotes,
        openTabs,
        currentNote,
        noteContentsCache,
        pendingDraftDiscardPath,
        isDirty,
        recentlyClosedTabs,
      } = get();
      const draftNote = draftNotes[path];
      if (!draftNote) {
        return;
      }

      const { [path]: _removedDraft, ...nextDraftNotes } = draftNotes;
      const isCurrentDraft = currentNote?.path === path;
      const closedTab = openTabs.find((tab) => tab.path === path);
      const closedTabIndex = openTabs.findIndex((tab) => tab.path === path);
      const updatedTabs = openTabs.filter((tab) => tab.path !== path);
      const contentSnapshot = isCurrentDraft
        ? currentNote.content
        : noteContentsCache.get(path)?.content ?? '';
      const modifiedAtSnapshot = noteContentsCache.get(path)?.modifiedAt ?? null;

      set({
        draftNotes: nextDraftNotes,
        openTabs: updatedTabs,
        recentlyClosedTabs: closedTab
          ? pushRecentlyClosedTab(recentlyClosedTabs, closedTab, closedTabIndex, {
              draftNote,
              content: contentSnapshot,
              modifiedAt: modifiedAtSnapshot,
            })
          : recentlyClosedTabs,
        currentNote: isCurrentDraft ? null : currentNote,
        currentNoteRevision: isCurrentDraft ? get().currentNoteRevision + 1 : get().currentNoteRevision,
        noteContentsCache: removeCachedNoteContent(noteContentsCache, path),
        isDirty: isCurrentDraft ? false : isDirty,
        pendingDraftDiscardPath: pendingDraftDiscardPath === path ? null : pendingDraftDiscardPath,
      });

      if (isCurrentDraft) {
        const lastTab = updatedTabs[updatedTabs.length - 1];
        if (lastTab) {
          void openStoredNotePath(lastTab.path, {
            openNote: get().openNote,
            openNoteByAbsolutePath: get().openNoteByAbsolutePath,
          });
        }
      }
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
        draftNotes,
        noteContentsCache,
      } = get();

      const pathIsAbsolute = isAbsolutePath(path);
      const { isNewlyCreated } = get();
      const closingTab = openTabs.find((tab) => tab.path === path);
      const draftNote = draftNotes[path];
      if (draftNote) {
        const draftContent = currentNote?.path === path
          ? currentNote.content
          : noteContentsCache.get(path)?.content ?? '';
        const hasUnsavedDraftContent =
          Boolean(closingTab?.isDirty) ||
          Boolean(draftNote.name.trim()) ||
          Boolean(draftContent.trim());

        if (hasUnsavedDraftContent) {
          set({ pendingDraftDiscardPath: path });
        } else {
          get().discardDraftNote(path);
        }
        return;
      }

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
      set({
        openTabs: updatedTabs,
        recentlyClosedTabs: closingTab
          ? pushRecentlyClosedTab(recentlyClosedTabs, closingTab, openTabs.findIndex((tab) => tab.path === path))
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

        if (entry.draftNote) {
          const nextCache = setCachedNoteContent(
            get().noteContentsCache,
            entry.tab.path,
            entry.content ?? '',
            entry.modifiedAt ?? null,
          );
          const nextTabs = alreadyOpen
            ? get().openTabs
            : restoreClosedTabOrder([...get().openTabs, entry.tab], entry.tab.path, entry.index);

          set({
            currentNote: { path: entry.tab.path, content: entry.content ?? '' },
            currentNoteRevision: get().currentNoteRevision + 1,
            isDirty: entry.tab.isDirty,
            openTabs: nextTabs,
            draftNotes: {
              ...get().draftNotes,
              [entry.tab.path]: entry.draftNote,
            },
            noteContentsCache: nextCache,
            recentlyClosedTabs: remainingTabs,
            error: null,
          });
          return;
        }

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
