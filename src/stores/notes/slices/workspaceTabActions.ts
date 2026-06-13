import { isAbsolutePath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { updateDisplayName } from '../displayNameUtils';
import { hasDraftUnsavedChanges, resolveDraftNoteTitle } from '../draftNote';
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
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';

type NotesState = ReturnType<NotesGet>;

function getDraftContentSnapshot(state: NotesState, path: string): string {
  return state.currentNote?.path === path
    ? state.currentNote.content
    : state.noteContentsCache.get(path)?.content ?? '';
}

function draftHasUnsavedChanges(state: NotesState, path: string): boolean {
  const draftNote = state.draftNotes[path];
  if (!draftNote) {
    return false;
  }

  return hasDraftUnsavedChanges({
    draftName: draftNote.name,
    content: getDraftContentSnapshot(state, path),
    metadata: state.noteMetadata?.notes[path],
  });
}

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

function getKnownClosedTabModifiedAt(modifiedAt: number | null | undefined): number | null {
  return typeof modifiedAt === 'number' && Number.isFinite(modifiedAt)
    ? modifiedAt
    : null;
}

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

    discardDraftNote: (path, options) => {
      const {
        draftNotes,
        openTabs,
        currentNote,
        noteContentsCache,
        pendingDraftDiscardPath,
        isDirty,
        recentlyClosedTabs,
      } = get();
      const preserveHistory = options?.preserveHistory ?? true;
      const activateFallback = options?.activateFallback ?? true;
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
        recentlyClosedTabs: preserveHistory && closedTab
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

      if (isCurrentDraft && activateFallback) {
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

    closeNote: async () => {
      flushCurrentPendingEditorMarkdown();

      const noteBeforeClose = get().currentNote;
      if (!noteBeforeClose) {
        return;
      }

      const path = noteBeforeClose.path;
      const stateAfterFlush = get();
      const draftNote = stateAfterFlush.draftNotes[path];
      const currentTab = stateAfterFlush.openTabs.find((tab) => tab.path === path);

      if (draftNote) {
        if (draftHasUnsavedChanges(stateAfterFlush, path)) {
          set({ pendingDraftDiscardPath: path });
          return;
        }

        stateAfterFlush.discardDraftNote(path, { preserveHistory: false });
        return;
      } else if (stateAfterFlush.isDirty || currentTab?.isDirty) {
        await stateAfterFlush.saveNote();
        const stateAfterSave = get();
        const latestTab = stateAfterSave.openTabs.find((tab) => tab.path === path);
        if (
          (stateAfterSave.currentNote?.path === path && stateAfterSave.isDirty) ||
          latestTab?.isDirty
        ) {
          set({ error: 'Save the note before closing it.' });
          return;
        }
      }

      const { notesPath, rootFolder, fileTreeSortMode } = get();
      if (get().currentNote?.path !== path) {
        return;
      }
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
      flushCurrentPendingEditorMarkdown();
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
      if (draftNote) {
        if (draftHasUnsavedChanges(get(), path)) {
          set({ pendingDraftDiscardPath: path });
        } else {
          get().discardDraftNote(path, { preserveHistory: false });
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
        if (get().isDirty) {
          set({ error: 'Save the note before closing it.' });
          return;
        }
      }

      if (currentNote?.path !== path && closingTab?.isDirty) {
        const cachedContent = noteContentsCache.get(path)?.content;
        if (cachedContent === undefined) {
          set({ error: 'Failed to close dirty tab because its cached content is missing.' });
          return;
        }

        try {
          const { content, metadata, modifiedAt, size } = await saveNoteDocument({
            notesPath,
            currentNote: { path, content: cachedContent },
            cache: noteContentsCache,
          });
          const latestState = get();
          if (latestState.notesPath !== notesPath) {
            return;
          }
          const latestCachedContent = latestState.currentNote?.path === path
            ? latestState.currentNote.content
            : latestState.noteContentsCache.get(path)?.content;
          const hasNewerEdit =
            latestCachedContent !== undefined &&
            latestCachedContent !== cachedContent;
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
            noteContentsCache: setCachedNoteContent(
              latestState.noteContentsCache,
              path,
              hasNewerEdit ? latestCachedContent : content,
              modifiedAt,
              hasNewerEdit ? { baselineContent: content, size } : { updateBaseline: true, size },
            ),
            isDirty: latestState.currentNote?.path === path && hasNewerEdit
              ? true
              : latestState.isDirty,
            openTabs: setNoteTabDirtyState(latestState.openTabs, path, hasNewerEdit),
            error: null,
          });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to save dirty tab before closing.' });
          return;
        }
      }

      const latestBeforeClose = get();
      const tabsBeforeClose = latestBeforeClose.openTabs;
      const tabBeforeClose = tabsBeforeClose.find((tab) => tab.path === path);
      if (tabBeforeClose?.isDirty) {
        set({ error: 'Save the note before closing it.' });
        return;
      }
      const updatedTabs = tabsBeforeClose.filter((t) => t.path !== path);
      set({
        openTabs: updatedTabs,
        noteContentsCache: removeCachedNoteContent(latestBeforeClose.noteContentsCache, path),
        recentlyClosedTabs: tabBeforeClose
          ? pushRecentlyClosedTab(
              latestBeforeClose.recentlyClosedTabs,
              tabBeforeClose,
              tabsBeforeClose.findIndex((tab) => tab.path === path)
            )
          : latestBeforeClose.recentlyClosedTabs,
      });

      if (latestBeforeClose.currentNote?.path === path) {
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
          const latestAfterClose = get();
          persistWorkspaceSnapshot(notesPath, {
            rootFolder: latestAfterClose.rootFolder ?? rootFolder,
            currentNotePath: null,
            fileTreeSortMode: latestAfterClose.fileTreeSortMode ?? fileTreeSortMode,
          });
        }
      }
    },

    reopenClosedTab: async () => {
      flushCurrentPendingEditorMarkdown();
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
            getKnownClosedTabModifiedAt(entry.modifiedAt),
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
