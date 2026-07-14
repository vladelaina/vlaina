import { createEmptyMetadataFile, setNoteEntry } from '../storage';
import {
  getCachedNoteModifiedAt,
  pruneCachedNoteContents,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { stripUpdatedFrontmatter } from '../frontmatter';
import {
  buildSortedRootFolder,
  shouldRebuildRootFolderForMetadataChange,
} from '../utils/fs/rootFolderState';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { createWorkspaceDiskSyncAction } from './workspaceDiskSyncActions';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { saveDraftNote } from './workspaceDraftSave';
import { normalizeEditorStateMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';
import {
  getExternalPathMutationRevision,
  wasPathExternallyMutatedSince,
} from '../document/externalPathMutationRegistry';
import { isDraftNotePath } from '../draftNote';

type WorkspaceDocumentActions = Pick<
  WorkspaceSlice,
  'saveNote' | 'syncCurrentNoteFromDisk' | 'invalidateNoteCache' | 'updateContent'
>;

function shouldKeepEditorContentAfterSave(editorContent: string | undefined, savedContent: string): editorContent is string {
  if (editorContent === undefined || editorContent === savedContent) {
    return false;
  }
  if (!editorContent.includes('\u2800') && !/<br\s/i.test(editorContent)) {
    return false;
  }
  return stripUpdatedFrontmatter(normalizeEditorStateMarkdownDocument(editorContent))
    === stripUpdatedFrontmatter(savedContent);
}

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
    const pathMutationRevision = getExternalPathMutationRevision();

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

      const { content, metadata, modifiedAt, size } = await saveNoteDocument({
        notesPath,
        currentNote,
        cache: noteContentsCache,
      });
      const latestState = get();
      if (latestState.notesPath !== notesPath) {
        return;
      }
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

      const metadataBase = latestState.noteMetadata ?? noteMetadata ?? createEmptyMetadataFile();
      const nextMetadata = setNoteEntry(
        metadataBase,
        currentNote.path,
        metadata,
      );
      const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
      const latestRootFolder = latestState.rootFolder ?? rootFolder;
      const shouldRebuildRootFolder = shouldRebuildRootFolderForMetadataChange(
        latestSortMode,
        metadataBase.notes[currentNote.path],
        nextMetadata.notes[currentNote.path],
      );
      const nextRootFolder = shouldRebuildRootFolder
        ? buildSortedRootFolder(
            latestRootFolder,
            latestRootFolder?.children ?? [],
            latestSortMode,
            nextMetadata,
          )
        : latestRootFolder;
      const hasNewerSaveTargetEdit =
        latestSaveTargetContent !== undefined &&
        latestSaveTargetContent !== contentAtSaveStart;
      const pathWasExternallyMutatedDuringSave =
        wasPathExternallyMutatedSince(currentNote.path, pathMutationRevision);

      if (hasNewerSaveTargetEdit || pathWasExternallyMutatedDuringSave) {
        const preservedContent = latestSaveTargetContent ?? contentAtSaveStart;
        set({
          isDirty: currentSaveTargetStillActive ? true : latestState.isDirty,
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: setCachedNoteContent(
            latestState.noteContentsCache,
            currentNote.path,
            preservedContent,
            modifiedAt,
            { baselineContent: content, size },
          ),
          openTabs: setNoteTabDirtyState(latestState.openTabs, currentNote.path, true),
          error: pathWasExternallyMutatedDuringSave
            ? latestState.error ?? 'Current note changed outside vlaina while saving. Its latest content is preserved; save again after reviewing it.'
            : null,
        });
        return;
      }

      const shouldKeepEditorContent = shouldKeepEditorContentAfterSave(
        latestSaveTargetContent,
        content,
      );
      const nextVisibleContent = shouldKeepEditorContent ? latestSaveTargetContent : content;
      set({
        currentNote: currentSaveTargetStillActive
          ? { path: currentNote.path, content: nextVisibleContent }
          : latestState.currentNote,
        currentNoteRevision: currentSaveTargetStillActive && nextVisibleContent !== latestCurrentNote?.content
          ? get().currentNoteRevision + 1
          : get().currentNoteRevision,
        isDirty: currentSaveTargetStillActive ? false : latestState.isDirty,
        noteMetadata: nextMetadata,
        rootFolder: nextRootFolder,
        noteContentsCache: setCachedNoteContent(
          latestState.noteContentsCache,
          currentNote.path,
          nextVisibleContent,
          modifiedAt,
          shouldKeepEditorContent
            ? { baselineContent: content, size }
            : { updateBaseline: true, size },
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

    invalidateNoteCache: (path: string, options?: { includeDescendants?: boolean }) => {
      const { currentNote, noteContentsCache, openTabs } = get();
      const noteContentsCacheRevision = get().noteContentsCacheRevision ?? 0;
      const dirtyOpenTabPaths = new Set(
        openTabs.filter((tab) => tab.isDirty).map((tab) => tab.path)
      );
      const shouldInvalidate = (cachedPath: string) => {
        if (cachedPath === currentNote?.path || dirtyOpenTabPaths.has(cachedPath)) {
          return false;
        }

        if (cachedPath === path) {
          return true;
        }

        if (!options?.includeDescendants) {
          return false;
        }

        return path ? cachedPath.startsWith(`${path}/`) : true;
      };
      const nextCache = pruneCachedNoteContents(noteContentsCache, shouldInvalidate);
      set({
        noteContentsCache: nextCache,
        noteContentsCacheRevision: noteContentsCacheRevision + 1,
      });
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
        noteContentsCache: isDraftNotePath(currentNote.path)
          ? setCachedNoteContent(
              noteContentsCache,
              currentNote.path,
              content,
              getCachedNoteModifiedAt(noteContentsCache, currentNote.path)
            )
          : noteContentsCache,
      });
    },
  };
}
