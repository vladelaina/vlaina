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
  return {
    saveNote: async (options) => {
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
        return;
      }
      const notePathAtSaveStart = currentNote.path;
      const wasDirtyAtSaveStart = get().isDirty;

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
          const { content, metadata, nextCache } = await saveNoteDocument({
            notesPath,
            currentNote: { path: savedPath, content: currentNote.content },
            cache: noteContentsCache,
          });
          if (!isCurrentSaveTarget(get, notesPath, notePathAtSaveStart)) return;

          const tabName = getNoteTitleFromPath(savedPath);
          const nextTabs = openTabs
            .map((tab) =>
              tab.path === currentNote.path
                ? { path: savedPath, name: tabName, isDirty: false }
                : tab,
            )
            .filter((tab, index, tabs) => tabs.findIndex((candidate) => candidate.path === tab.path) === index);

          const nextDisplayNames = new Map(displayNames);
          nextDisplayNames.delete(currentNote.path);
          nextDisplayNames.set(savedPath, tabName);

          const nextDraftNotes = { ...draftNotes };
          delete nextDraftNotes[currentNote.path];

          let nextMetadata = remapMetadataEntries(noteMetadata ?? createEmptyMetadataFile(), (path) => {
            if (path === currentNote.path) return relativePath ?? null;
            return path;
          }) ?? createEmptyMetadataFile();

          nextMetadata = setNoteEntry(nextMetadata, savedPath, metadata);

          const nextCacheWithSavedNote = removeCachedNoteContent(nextCache, currentNote.path);
          const nextRecentNotes = relativePath ? addToRecentNotes(relativePath, recentNotes) : recentNotes;
          if (nextRecentNotes !== recentNotes) {
            persistRecentNotes(nextRecentNotes);
          }

          let nextRootFolder = rootFolder;
          if (relativePath && rootFolder && !findNode(rootFolder.children, relativePath)) {
            nextRootFolder = buildSortedRootFolder(
              rootFolder,
              addNodeToTree(rootFolder.children, getParentPath(relativePath), {
                id: relativePath,
                name: tabName,
                path: relativePath,
                isFolder: false as const,
              }),
              fileTreeSortMode,
              nextMetadata,
            );
          } else if (relativePath) {
            nextRootFolder = buildSortedRootFolder(
              rootFolder,
              rootFolder?.children ?? [],
              fileTreeSortMode,
              nextMetadata,
            );
          }

          invalidatePendingFileTreeLoads();
          set({
            currentNote: { path: savedPath, content },
            currentNoteRevision: get().currentNoteRevision + 1,
            isDirty: false,
            noteMetadata: nextMetadata,
            rootFolder: nextRootFolder,
            noteContentsCache: nextCacheWithSavedNote,
            openTabs: nextTabs,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            draftNotes: nextDraftNotes,
            pendingDraftDiscardPath: pendingDraftDiscardPath === currentNote.path ? null : pendingDraftDiscardPath,
            error: null,
          });

          persistWorkspaceSnapshot(notesPath, {
            rootFolder: nextRootFolder,
            currentNotePath: relativePath ?? null,
            fileTreeSortMode,
          });

          if (!relativePath && !options?.suppressOpenTarget) {
            dispatchOpenMarkdownTargetEvent(absolutePath);
          }

          return;
        }

        const { content, metadata, nextCache } = await saveNoteDocument({
          notesPath,
          currentNote,
          cache: noteContentsCache,
        });
        if (!isCurrentSaveTarget(get, notesPath, notePathAtSaveStart)) return;

        const nextMetadata = setNoteEntry(
          noteMetadata ?? createEmptyMetadataFile(),
          currentNote.path,
          metadata,
        );
        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          rootFolder?.children ?? [],
          fileTreeSortMode,
          nextMetadata,
        );

        set({
          currentNote: { path: currentNote.path, content },
          currentNoteRevision: get().currentNoteRevision + 1,
          isDirty: false,
          noteMetadata: nextMetadata,
          rootFolder: nextRootFolder,
          noteContentsCache: nextCache,
          openTabs: setNoteTabDirtyState(get().openTabs, currentNote.path, false),
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
    },

    ...createWorkspaceDiskSyncAction(set, get),

    invalidateNoteCache: (path: string) => {
      const { currentNote, noteContentsCache } = get();
      if (currentNote?.path === path) return;
      set({ noteContentsCache: removeCachedNoteContent(noteContentsCache, path) });
    },

    updateContent: (content: string) => {
      const { currentNote, noteContentsCache, openTabs } = get();
      if (!currentNote || currentNote.content === content) {
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
