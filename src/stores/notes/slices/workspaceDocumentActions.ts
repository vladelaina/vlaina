import { getParentPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { addToRecentNotes, createEmptyMetadataFile, persistRecentNotes, remapMetadataEntries, setNoteEntry } from '../storage';
import { addNodeToTree, findNode } from '../fileTreeUtils';
import { chooseDraftSavePath, resolveDraftSaveLocation } from '../draftNoteSave';
import {
  getCachedNoteModifiedAt,
  removeCachedNoteContent,
  setCachedNoteContent,
} from '../document/noteContentCache';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { dispatchOpenMarkdownTargetEvent } from '@/components/Notes/features/OpenTarget/openTargetEvents';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { createWorkspaceDiskSyncAction } from './workspaceDiskSyncActions';
import { resolveUniquePath } from '../utils/fs/pathOperations';
import { invalidatePendingFileTreeLoads } from './fileSystemSliceTreeActions';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import {
  compareLineBreakText,
  logLineBreakDebug,
  logNotesDebug,
  summarizeLineBreakText,
} from '../lineBreakDebugLog';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';

type WorkspaceDocumentActions = Pick<
  WorkspaceSlice,
  'saveNote' | 'syncCurrentNoteFromDisk' | 'invalidateNoteCache' | 'updateContent'
>;

function isCurrentSaveTarget(get: NotesGet, notesPath: string, notePath: string) {
  const state = get();
  return state.notesPath === notesPath && state.currentNote?.path === notePath;
}

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
      recentNotes,
      displayNames,
      pendingDraftDiscardPath,
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
        if (!isCurrentSaveTarget(get, notesPath, notePathAtSaveStart)) return;

        const canAutoSaveDraftIntoCurrentVault =
          notesPath &&
          (draftNote.originNotesPath === undefined || draftNote.originNotesPath === notesPath);
        const draftSaveLocation = canAutoSaveDraftIntoCurrentVault
          ? await resolveUniquePath(
              notesPath,
              draftNote.parentPath ?? undefined,
              draftNote.name || 'Untitled',
              false,
            )
          : null;
        if (!draftSaveLocation && !options?.explicit) {
          return;
        }

        const selectedPath = draftSaveLocation?.fullPath ?? await chooseDraftSavePath(notesPath, draftNote);
        if (!selectedPath) {
          return;
        }
        if (!isCurrentSaveTarget(get, notesPath, notePathAtSaveStart)) return;

        const { absolutePath, relativePath } = draftSaveLocation
          ? {
              absolutePath: draftSaveLocation.fullPath,
              relativePath: draftSaveLocation.relativePath,
            }
          : resolveDraftSaveLocation(selectedPath, notesPath);
        const savedPath = relativePath ?? absolutePath;
        const { content, metadata, modifiedAt } = await saveNoteDocument({
          notesPath,
          currentNote: { path: savedPath, content: currentNote.content },
          cache: noteContentsCache,
        });

        const latestState = get();
        if (latestState.notesPath !== notesPath) return;
        const latestCurrentNote = latestState.currentNote;
        const draftStillCurrent = latestCurrentNote?.path === currentNote.path;
        const draftTabExists = latestState.openTabs.some((tab) => tab.path === currentNote.path);
        if (!draftStillCurrent && !draftTabExists) {
          return;
        }
        const latestDraftContent = draftStillCurrent
          ? latestCurrentNote.content
          : latestState.noteContentsCache.get(currentNote.path)?.content;
        const hasNewerDraftEdit =
          latestDraftContent !== undefined &&
          latestDraftContent !== contentAtSaveStart;
        const nextContent = hasNewerDraftEdit ? latestDraftContent : content;
        const tabName = getNoteTitleFromPath(savedPath);
        const nextTabs = latestState.openTabs
          .map((tab) =>
            tab.path === currentNote.path
              ? { path: savedPath, name: tabName, isDirty: hasNewerDraftEdit }
              : tab,
          )
          .filter((tab, index, tabs) => tabs.findIndex((candidate) => candidate.path === tab.path) === index);

        const nextDisplayNames = new Map(latestState.displayNames ?? displayNames);
        nextDisplayNames.delete(currentNote.path);
        nextDisplayNames.set(savedPath, tabName);

        const nextDraftNotes = { ...(latestState.draftNotes ?? draftNotes) };
        delete nextDraftNotes[currentNote.path];

        let nextMetadata = remapMetadataEntries(latestState.noteMetadata ?? noteMetadata ?? createEmptyMetadataFile(), (path) => {
          if (path === currentNote.path) return relativePath ?? null;
          return path;
        }) ?? createEmptyMetadataFile();

        nextMetadata = setNoteEntry(nextMetadata, savedPath, metadata);

        const nextCacheWithSavedNote = setCachedNoteContent(
          removeCachedNoteContent(latestState.noteContentsCache, currentNote.path),
          savedPath,
          nextContent,
          modifiedAt,
        );
        const latestRecentNotes = latestState.recentNotes ?? recentNotes;
        const nextRecentNotes = relativePath ? addToRecentNotes(relativePath, latestRecentNotes) : latestRecentNotes;
        if (nextRecentNotes !== latestRecentNotes) {
          persistRecentNotes(nextRecentNotes);
        }

        const latestRootFolder = latestState.rootFolder ?? rootFolder;
        const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
        let nextRootFolder = latestRootFolder;
        if (relativePath && latestRootFolder && !findNode(latestRootFolder.children, relativePath)) {
          nextRootFolder = buildSortedRootFolder(
            latestRootFolder,
            addNodeToTree(latestRootFolder.children, getParentPath(relativePath), {
              id: relativePath,
              name: tabName,
              path: relativePath,
              isFolder: false as const,
            }),
            latestSortMode,
            nextMetadata,
          );
        } else if (relativePath) {
          nextRootFolder = buildSortedRootFolder(
            latestRootFolder,
            latestRootFolder?.children ?? [],
            latestSortMode,
            nextMetadata,
          );
        }

        invalidatePendingFileTreeLoads();
        set({
          currentNote: draftStillCurrent
            ? { path: savedPath, content: nextContent }
            : latestState.currentNote,
          currentNoteRevision: draftStillCurrent
            ? get().currentNoteRevision + 1
            : get().currentNoteRevision,
          isDirty: draftStillCurrent ? hasNewerDraftEdit : latestState.isDirty,
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: nextCacheWithSavedNote,
          openTabs: nextTabs,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          draftNotes: nextDraftNotes,
          pendingDraftDiscardPath:
            latestState.pendingDraftDiscardPath === currentNote.path
              ? null
              : latestState.pendingDraftDiscardPath ?? pendingDraftDiscardPath,
          error: null,
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: relativePath ?? null,
          fileTreeSortMode: latestSortMode,
        });

        if (!relativePath && !options?.suppressOpenTarget) {
          dispatchOpenMarkdownTargetEvent(absolutePath);
        }

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
      if (!currentNote) {
        logNotesDebug('NotesDirty', 'update-content:skipped-no-current-note', {
          next: summarizeLineBreakText(content),
        });
        return;
      }
      if (currentNote.content === content) {
        logNotesDebug('NotesDirty', 'update-content:skipped-unchanged', {
          notePath: currentNote.path,
          current: summarizeLineBreakText(currentNote.content),
          next: summarizeLineBreakText(content),
        });
        return;
      }
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
