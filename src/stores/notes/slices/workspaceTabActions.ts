import { isAbsolutePath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { updateDisplayName } from '../displayNameUtils';
import { resolveDraftNoteTitle } from '../draftNote';
import { openStoredNotePath } from '../openNotePath';
import { removeCachedNoteContent, setCachedNoteContent } from '../document/noteContentCache';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import {
  pushRecentlyClosedTab,
  restoreClosedTabOrder,
} from '../document/recentlyClosedTabState';
import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { logNotesDebug, summarizeLineBreakText } from '../lineBreakDebugLog';
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
        draftNotes,
        noteContentsCache,
        noteMetadata,
      } = get();

      const pathIsAbsolute = isAbsolutePath(path);
      const { isNewlyCreated } = get();
      const closingTab = openTabs.find((tab) => tab.path === path);
      const draftNote = draftNotes[path];
      logNotesDebug('NotesTab', 'close:start', {
        path,
        currentNotePath: currentNote?.path ?? null,
        isDirty,
        closingTabDirty: closingTab?.isDirty ?? null,
        isDraft: Boolean(draftNote),
        openTabsLength: openTabs.length,
      });
      if (draftNote) {
        const draftContent = currentNote?.path === path
          ? currentNote.content
          : noteContentsCache.get(path)?.content ?? '';
        const hasUnsavedDraftContent =
          Boolean(closingTab?.isDirty) ||
          Boolean(draftNote.name.trim()) ||
          Boolean(draftContent.trim());

        if (hasUnsavedDraftContent) {
          logNotesDebug('NotesTab', 'close:draft-needs-discard-confirm', {
            path,
            hasTabDirty: Boolean(closingTab?.isDirty),
            hasDraftName: Boolean(draftNote.name.trim()),
            draftContent: summarizeLineBreakText(draftContent),
          });
          set({ pendingDraftDiscardPath: path });
        } else {
          logNotesDebug('NotesTab', 'close:draft-discard-empty', { path });
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
        logNotesDebug('NotesTab', 'close:delete-empty-new-note', { path });
        await get().deleteNote(path);
        return;
      }

      if (currentNote?.path === path && isDirty) {
        logNotesDebug('NotesTab', 'close:save-current-dirty-before-close', {
          path,
          current: summarizeLineBreakText(currentNote.content),
        });
        await saveNote();
        if (get().isDirty) {
          logNotesDebug('NotesTab', 'close:blocked-current-still-dirty', {
            path,
            isDirtyAfterSave: get().isDirty,
          });
          return;
        }
      }

      if (currentNote?.path !== path && closingTab?.isDirty) {
        const cachedContent = noteContentsCache.get(path)?.content;
        if (cachedContent === undefined) {
          logNotesDebug('NotesTab', 'close:background-dirty-missing-cache', { path });
          set({ error: 'Failed to close dirty tab because its cached content is missing.' });
          return;
        }

        try {
          logNotesDebug('NotesTab', 'close:save-background-dirty-tab:start', {
            path,
            notesPath,
            content: summarizeLineBreakText(cachedContent),
          });
          const { metadata, nextCache } = await saveNoteDocument({
            notesPath,
            currentNote: { path, content: cachedContent },
            cache: noteContentsCache,
          });
          const latestState = get();
          const nextMetadata = setNoteEntry(
            latestState.noteMetadata ?? noteMetadata ?? createEmptyMetadataFile(),
            path,
            metadata,
          );
          const nextRootFolder = buildSortedRootFolder(
            latestState.rootFolder,
            latestState.rootFolder?.children ?? [],
            latestState.fileTreeSortMode,
            nextMetadata,
          );

          set({
            noteMetadata: nextMetadata,
            rootFolder: nextRootFolder,
            noteContentsCache: nextCache,
            openTabs: setNoteTabDirtyState(latestState.openTabs, path, false),
            error: null,
          });
          logNotesDebug('NotesTab', 'close:save-background-dirty-tab:done', { path });
        } catch (error) {
          logNotesDebug('NotesTab', 'close:save-background-dirty-tab:failed', {
            path,
            message: error instanceof Error ? error.message : String(error),
          });
          set({ error: error instanceof Error ? error.message : 'Failed to save dirty tab before closing.' });
          return;
        }
      }

      const latestBeforeClose = get();
      const tabsBeforeClose = latestBeforeClose.openTabs;
      const tabBeforeClose = tabsBeforeClose.find((tab) => tab.path === path);
      const updatedTabs = tabsBeforeClose.filter((t) => t.path !== path);
      set({
        openTabs: updatedTabs,
        recentlyClosedTabs: tabBeforeClose
          ? pushRecentlyClosedTab(
              latestBeforeClose.recentlyClosedTabs,
              tabBeforeClose,
              tabsBeforeClose.findIndex((tab) => tab.path === path)
            )
          : latestBeforeClose.recentlyClosedTabs,
      });
      logNotesDebug('NotesTab', 'close:removed-tab', {
        path,
        closedCurrent: currentNote?.path === path,
        nextOpenTabsLength: updatedTabs.length,
        nextOpenTabPaths: updatedTabs.map((tab) => tab.path),
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
          logNotesDebug('NotesTab', 'close:no-tabs-left', { path });
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
