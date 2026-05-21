import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  removeCachedNoteContent,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { createWorkspaceDiskSyncAction } from './workspaceDiskSyncActions';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import {
  compareLineBreakText,
  isNotesDebugLoggingEnabled,
  logLineBreakDebug,
  logNotesDebug,
  summarizeLineBreakText,
} from '../lineBreakDebugLog';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { saveDraftNote } from './workspaceDraftSave';

type WorkspaceDocumentActions = Pick<
  WorkspaceSlice,
  'saveNote' | 'syncCurrentNoteFromDisk' | 'invalidateNoteCache' | 'updateContent'
>;

export function createWorkspaceDocumentActions(
  set: NotesSet,
  get: NotesGet
): WorkspaceDocumentActions {
  let saveInFlight: Promise<void> | null = null;

  const performSaveNote: WorkspaceSlice['saveNote'] = async (options) => {
    logLineBreakDebug('save:start-before-flush', {
      options: options ?? null,
      currentNotePath: get().currentNote?.path ?? null,
      isDirty: get().isDirty,
      current: summarizeLineBreakText(get().currentNote?.content),
    });
    const flushed = flushCurrentPendingEditorMarkdown();
    logLineBreakDebug('save:after-flush', {
      flushed,
      currentNotePath: get().currentNote?.path ?? null,
      isDirty: get().isDirty,
      current: summarizeLineBreakText(get().currentNote?.content),
    });
    const {
      currentNote,
      notesPath,
      noteContentsCache,
      noteMetadata,
      rootFolder,
      fileTreeSortMode,
      draftNotes,
      openTabs,
    } = get();
    if (!currentNote) {
      logNotesDebug('NotesDirty', 'save:skipped-no-current-note', {
        options: options ?? null,
        notesPath,
        openTabsLength: openTabs.length,
        isDirty: get().isDirty,
      });
      return;
    }
    const notePathAtSaveStart = currentNote.path;
    const contentAtSaveStart = currentNote.content;
    const wasDirtyAtSaveStart = get().isDirty;
    logNotesDebug('NotesDirty', 'save:resolved-current', {
      notePathAtSaveStart,
      wasDirtyAtSaveStart,
      isDraft: Boolean(draftNotes[currentNote.path]),
      openTabs: openTabs.map((tab) => ({
        path: tab.path,
        isDirty: tab.isDirty,
      })),
      content: summarizeLineBreakText(currentNote.content),
    });

    try {
      const draftNote = draftNotes[currentNote.path];
      if (draftNote) {
        await saveDraftNote({
          set,
          get,
          options,
          notePathAtSaveStart,
          contentAtSaveStart,
        });
        return;
      }

      if (!wasDirtyAtSaveStart) {
        logNotesDebug('NotesDirty', 'save:skipped-clean-regular-note', {
          notePathAtSaveStart,
          options: options ?? null,
        });
        return;
      }

      const { content, metadata, modifiedAt } = await saveNoteDocument({
        notesPath,
        currentNote,
        cache: noteContentsCache,
      });
      logLineBreakDebug('save:regular-write-result', {
        notePath: currentNote.path,
        input: summarizeLineBreakText(currentNote.content),
        saved: summarizeLineBreakText(content),
      });
      const latestState = get();
      if (latestState.notesPath !== notesPath) return;
      const latestCurrentNote = latestState.currentNote;
      const currentSaveTargetStillActive = latestCurrentNote?.path === notePathAtSaveStart;
      const latestCachedContent = latestState.noteContentsCache.get(currentNote.path)?.content;
      const latestSaveTargetContent = currentSaveTargetStillActive
        ? latestCurrentNote.content
        : latestCachedContent;
      const saveTargetTabExists = latestState.openTabs.some((tab) => tab.path === currentNote.path);
      if (!currentSaveTargetStillActive && !saveTargetTabExists) {
        return;
      }

      const nextMetadata = setNoteEntry(
        latestState.noteMetadata ?? noteMetadata ?? createEmptyMetadataFile(),
        currentNote.path,
        metadata,
      );
      const nextRootFolder = buildSortedRootFolder(
        latestState.rootFolder ?? rootFolder,
        latestState.rootFolder?.children ?? rootFolder?.children ?? [],
        latestState.fileTreeSortMode ?? fileTreeSortMode,
        nextMetadata,
      );
      const hasNewerSaveTargetEdit =
        latestSaveTargetContent !== undefined &&
        latestSaveTargetContent !== contentAtSaveStart;

      if (hasNewerSaveTargetEdit) {
        set({
          isDirty: currentSaveTargetStillActive ? true : latestState.isDirty,
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: setCachedNoteContent(
            latestState.noteContentsCache,
            currentNote.path,
            latestSaveTargetContent,
            modifiedAt
          ),
          openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, true),
          error: null,
        });
        logLineBreakDebug('save:regular-kept-newer-edit-dirty', {
          notePath: currentNote.path,
          saved: summarizeLineBreakText(content),
          latest: summarizeLineBreakText(latestSaveTargetContent),
        });
        return;
      }

      set({
        currentNote: currentSaveTargetStillActive
          ? { path: currentNote.path, content }
          : latestState.currentNote,
        currentNoteRevision: currentSaveTargetStillActive
          ? get().currentNoteRevision + 1
          : get().currentNoteRevision,
        isDirty: currentSaveTargetStillActive ? false : latestState.isDirty,
        noteMetadata: nextMetadata,
        rootFolder: nextRootFolder,
        noteContentsCache: setCachedNoteContent(
          latestState.noteContentsCache,
          currentNote.path,
          content,
          modifiedAt,
        ),
        openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, false),
        error: null,
      });
      logLineBreakDebug('save:regular-set-complete', {
        notePath: currentNote.path,
        isDirty: false,
        content: summarizeLineBreakText(content),
      });
    } catch (error) {
      if (get().notesPath !== notesPath) return;

      const currentState = get();
      const dirtyPath = currentState.currentNote?.path ?? notePathAtSaveStart;
      logNotesDebug('NotesDirty', 'save:failed', {
        notePathAtSaveStart,
        dirtyPath,
        wasDirtyAtSaveStart,
        message: error instanceof Error ? error.message : String(error),
      });
      set({
        error: error instanceof Error ? error.message : 'Failed to save note',
        ...(wasDirtyAtSaveStart
          ? {
              isDirty: true,
              openTabs: setNoteTabDirtyState(
                setNoteTabDirtyState(currentState.openTabs, dirtyPath, true),
                notePathAtSaveStart,
                true,
              ),
            }
          : {}),
      });
    }
  };

  return {
    saveNote: async (options) => {
      while (saveInFlight) {
        await saveInFlight;
        if (!options?.explicit && !get().isDirty) {
          return;
        }
      }

      const save = performSaveNote(options);
      saveInFlight = save;
      try {
        await save;
      } finally {
        if (saveInFlight === save) {
          saveInFlight = null;
        }
      }
    },

    ...createWorkspaceDiskSyncAction(set, get),

    invalidateNoteCache: (path: string) => {
      const { currentNote, noteContentsCache, openTabs } = get();
      if (currentNote?.path === path) {
        logNotesDebug('NotesDirty', 'invalidate-cache:skipped-current', {
          path,
        });
        return;
      }
      if (openTabs.some((tab) => tab.path === path && tab.isDirty)) {
        logNotesDebug('NotesDirty', 'invalidate-cache:skipped-dirty-open-tab', {
          path,
        });
        return;
      }
      logNotesDebug('NotesDirty', 'invalidate-cache', {
        path,
        cacheHasPath: noteContentsCache.has(path),
      });
      set({ noteContentsCache: removeCachedNoteContent(noteContentsCache, path) });
    },

    updateContent: (content: string) => {
      const { currentNote, noteContentsCache, openTabs } = get();
      const debugEnabled = isNotesDebugLoggingEnabled();
      if (!currentNote) {
        if (debugEnabled) {
          logNotesDebug('NotesDirty', 'update-content:skipped-no-current-note', {
            next: summarizeLineBreakText(content),
          });
        }
        return;
      }
      if (currentNote.content === content) {
        if (debugEnabled) {
          logNotesDebug('NotesDirty', 'update-content:skipped-unchanged', {
            notePath: currentNote.path,
            current: summarizeLineBreakText(currentNote.content),
            next: summarizeLineBreakText(content),
          });
        }
        return;
      }
      if (debugEnabled) {
        logNotesDebug('NotesDirty', 'update-content:apply', {
          notePath: currentNote.path,
          previousDirty: get().isDirty,
          previous: summarizeLineBreakText(currentNote.content),
          next: summarizeLineBreakText(content),
          diff: compareLineBreakText(currentNote.content, content),
          openTabs: openTabs.map((tab) => ({
            path: tab.path,
            isDirty: tab.isDirty,
          })),
        });
      }
      set({
        currentNote: { ...currentNote, content },
        currentNoteRevision: get().currentNoteRevision + 1,
        isDirty: true,
        openTabs: setNoteTabDirtyState(openTabs, currentNote.path, true),
        noteContentsCache: setCachedNoteContent(
          noteContentsCache,
          currentNote.path,
          content,
          getCachedNoteModifiedAt(noteContentsCache, currentNote.path)
        ),
      });
    },
  };
}
