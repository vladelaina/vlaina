import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  removeCachedNoteContent,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { createWorkspaceDiskSyncAction } from './workspaceDiskSyncActions';
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
    flushCurrentPendingEditorMarkdown();
    const {
      currentNote,
      notesPath,
      noteContentsCache,
      noteMetadata,
      rootFolder,
      fileTreeSortMode,
      draftNotes,
    } = get();
    if (!currentNote) {
      return;
    }
    const notePathAtSaveStart = currentNote.path;
    const contentAtSaveStart = currentNote.content;
    const wasDirtyAtSaveStart = get().isDirty;

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
        return;
      }

      const { content, metadata, modifiedAt } = await saveNoteDocument({
        notesPath,
        currentNote,
        cache: noteContentsCache,
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
            modifiedAt,
            { baselineContent: content },
          ),
          openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, true),
          error: null,
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
          { updateBaseline: true },
        ),
        openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, false),
        error: null,
      });
    } catch (error) {
      if (get().notesPath !== notesPath) return;

      const currentState = get();
      const dirtyPath = currentState.currentNote?.path ?? notePathAtSaveStart;
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
        return;
      }
      if (openTabs.some((tab) => tab.path === path && tab.isDirty)) {
        return;
      }
      set({ noteContentsCache: removeCachedNoteContent(noteContentsCache, path) });
    },

    updateContent: (content: string) => {
      const { currentNote, noteContentsCache, openTabs } = get();
      if (!currentNote) {
        return;
      }
      if (currentNote.content === content) {
        return;
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
