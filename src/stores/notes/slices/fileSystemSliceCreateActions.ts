import {
  createEmptyMetadataFile,
  ensureNotesFolder,
  getCurrentNotesRootPath,
  getNotesBasePath,
  setNoteEntry,
} from '../storage';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { pushNoteNavigationHistory } from '../document/noteNavigationHistory';
import {
  createBlankDraftState,
  ensureRootFolderState,
} from './fileSystemSliceHelpers';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import { createCreateFolderAction } from './fileSystemSliceCreateFolderAction';
import { finalizeCreatedNote } from './fileSystemSliceCreateFinalize';
import { createDuplicateNoteAction } from './fileSystemSliceDuplicateAction';
import {
  ensureCurrentNoteSaved,
  getStateAfterFlushingCurrentNote,
  isActiveNotesPath,
} from './fileSystemSliceCreateShared';

export function createFileSystemCreateActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<
  FileSystemSlice,
  'createNote' | 'createNoteWithContent' | 'duplicateNote' | 'createFolder' | 'clearNewlyCreatedFolder'
> {
  return {
    createNote: async (folderPath?: string, options?: { asDraft?: boolean }) => {
      let notesPathForError = '';
      try {
        if (options?.asDraft) {
          const {
            notesPath,
            openTabs,
            currentNote,
            noteContentsCache,
            draftNotes,
            displayNames,
            currentNoteRevision,
          } = getStateAfterFlushingCurrentNote(get);
          notesPathForError = notesPath;
          const { draftPath, nextState } = createBlankDraftState({
            folderPath,
            originNotesPath: notesPath || '',
            kind: notesPath ? 'notesRoot' : 'scratch',
            openTabs,
            currentNote,
            currentNoteRevision,
            noteContentsCache,
            draftNotes,
            displayNames,
          });
          set({
            ...nextState,
            ...pushNoteNavigationHistory(
              {
                currentNote,
                noteNavigationHistory: get().noteNavigationHistory,
                noteNavigationHistoryIndex: get().noteNavigationHistoryIndex,
              },
              draftPath,
            ),
          });
          return draftPath;
        }

        let {
          notesPath,
          openTabs,
          rootFolder,
          currentNote,
          fileTreeSortMode,
          noteContentsCache,
          noteMetadata,
          draftNotes,
          displayNames,
          currentNoteRevision,
        } = await ensureCurrentNoteSaved(get, { skipDraft: true });
        notesPathForError = notesPath;

        if (!notesPath) {
          const currentNotesRootPath = getCurrentNotesRootPath();
          if (!currentNotesRootPath) {
            const { draftPath, nextState } = createBlankDraftState({
              folderPath,
              originNotesPath: '',
              kind: 'scratch',
              openTabs,
              currentNote,
              currentNoteRevision,
              noteContentsCache,
              draftNotes,
              displayNames,
            });
            set({
              ...nextState,
              ...pushNoteNavigationHistory(
                {
                  currentNote,
                  noteNavigationHistory: get().noteNavigationHistory,
                  noteNavigationHistoryIndex: get().noteNavigationHistoryIndex,
                },
                draftPath,
              ),
            });
            return draftPath;
          }

          notesPath = currentNotesRootPath;
          notesPathForError = notesPath;
          await ensureNotesFolder(notesPath);
          set({ notesPath });
        }

        const currentRootFolder = ensureRootFolderState(rootFolder);
        const result = await createNoteImpl(notesPath, folderPath, undefined, '', {
          rootFolder: currentRootFolder,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return result.relativePath;
        }
        const latestState = get();
        const latestRootFolder = ensureRootFolderState(latestState.rootFolder);
        const latestMetadata = setNoteEntry(
          latestState.noteMetadata ?? createEmptyMetadataFile(),
          result.relativePath,
          result.updatedMetadata.notes[result.relativePath] ?? {},
        );

        return finalizeCreatedNote({
          set,
          notesPath,
          result,
          updatedMetadata: latestMetadata,
          fileTreeSortMode: latestState.fileTreeSortMode ?? fileTreeSortMode,
          noteContentsCache: latestState.noteContentsCache,
          openTabs: latestState.openTabs,
          currentNote: latestState.currentNote,
          currentRootFolder: latestRootFolder,
          navigationState: latestState,
        });
      } catch (error) {
        if (notesPathForError && !isActiveNotesPath(get, notesPathForError)) {
          throw error;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to create note' });
        throw error;
      }
    },

    duplicateNote: createDuplicateNoteAction(set, get),

    createNoteWithContent: async (folderPath: string | undefined, name: string, content: string) => {
      let {
        notesPath,
        rootFolder,
        fileTreeSortMode,
        noteMetadata,
      } = await ensureCurrentNoteSaved(get);

      try {
        if (!notesPath) {
          notesPath = await getNotesBasePath();
          await ensureNotesFolder(notesPath);
          set({ notesPath });
        }

        const currentRootFolder = ensureRootFolderState(rootFolder);
        const result = await createNoteImpl(notesPath, folderPath, name, content, {
          rootFolder: currentRootFolder,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return result.relativePath;
        }
        const latestState = get();
        const latestRootFolder = ensureRootFolderState(latestState.rootFolder);
        const latestMetadata = setNoteEntry(
          latestState.noteMetadata ?? createEmptyMetadataFile(),
          result.relativePath,
          result.updatedMetadata.notes[result.relativePath] ?? {},
        );

        return finalizeCreatedNote({
          set,
          notesPath,
          result,
          updatedMetadata: latestMetadata,
          fileTreeSortMode: latestState.fileTreeSortMode ?? fileTreeSortMode,
          noteContentsCache: latestState.noteContentsCache,
          openTabs: latestState.openTabs,
          currentNote: latestState.currentNote,
          currentRootFolder: latestRootFolder,
          navigationState: latestState,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          throw error;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to create note' });
        throw error;
      }
    },

    createFolder: createCreateFolderAction(set, get),

    clearNewlyCreatedFolder: () => set({ newlyCreatedFolderPath: null }),
  };
}
