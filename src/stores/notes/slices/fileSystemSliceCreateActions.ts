import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { getStorageAdapter } from '@/lib/storage/adapter';
import type { NotesStore } from '../types';
import { addNodeToTree } from '../fileTreeUtils';
import {
  createEmptyMetadataFile,
  ensureNotesFolder,
  getCurrentVaultPath,
  getNotesBasePath,
  addToRecentNotes,
  setNoteEntry,
} from '../storage';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { resolveUniquePath } from '../utils/fs/pathOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { setCachedNoteContent } from '../document/noteContentCache';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import {
  createBlankDraftState,
  ensureRootFolderState,
  replaceCurrentTabOrAppend,
} from './fileSystemSliceHelpers';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

type CreateNoteResult = Awaited<ReturnType<typeof createNoteImpl>>;

function isActiveNotesPath(get: FileSystemSliceGet, notesPath: string) {
  return get().notesPath === notesPath;
}

async function ensureCurrentNoteSaved(get: FileSystemSliceGet, options?: { skipDraft?: boolean }) {
  flushCurrentPendingEditorMarkdown();
  const state = get();
  if (!state.isDirty) {
    return state;
  }

  if (options?.skipDraft && state.currentNote && state.draftNotes[state.currentNote.path]) {
    return state;
  }

  await state.saveNote();

  return get();
}

function getStateAfterFlushingCurrentNote(get: FileSystemSliceGet) {
  flushCurrentPendingEditorMarkdown();
  return get();
}

function finalizeCreatedNote({
  set,
  notesPath,
  relativePath,
  content,
  fileName,
  updatedMetadata,
  folderPath,
  recentNotes,
  modifiedAt,
  size,
  fileTreeSortMode,
  noteContentsCache,
  openTabs,
  currentNote,
  currentRootFolder,
}: {
  set: FileSystemSliceSet;
  notesPath: string;
  relativePath: CreateNoteResult['relativePath'];
  content: CreateNoteResult['content'];
  fileName: CreateNoteResult['fileName'];
  updatedMetadata: CreateNoteResult['updatedMetadata'];
  folderPath?: string;
  recentNotes: NotesStore['recentNotes'];
  modifiedAt: CreateNoteResult['modifiedAt'];
  size: CreateNoteResult['size'];
  fileTreeSortMode: NotesStore['fileTreeSortMode'];
  noteContentsCache: NotesStore['noteContentsCache'];
  openTabs: NotesStore['openTabs'];
  currentNote: NotesStore['currentNote'];
  currentRootFolder: NonNullable<NotesStore['rootFolder']>;
}) {
  const nextRootFolder = buildSortedRootFolder(
    currentRootFolder,
    addNodeToTree(currentRootFolder.children, folderPath, {
      id: relativePath,
      name: getNoteTitleFromPath(fileName),
      path: relativePath,
      isFolder: false,
    }),
    fileTreeSortMode,
    updatedMetadata,
  );
  const updatedTabs = replaceCurrentTabOrAppend(openTabs, currentNote?.path, {
    path: relativePath,
    name: getNoteTitleFromPath(fileName),
    isDirty: false,
  });

  set({
    rootFolder: nextRootFolder,
    noteMetadata: updatedMetadata,
    currentNote: { path: relativePath, content },
    isDirty: false,
    openTabs: updatedTabs,
    recentNotes,
    isNewlyCreated: true,
    noteContentsCache: setCachedNoteContent(noteContentsCache, relativePath, content, modifiedAt, {
      updateBaseline: true,
      size,
    }),
  });

  persistWorkspaceSnapshot(notesPath, {
    rootFolder: nextRootFolder,
    currentNotePath: relativePath,
    fileTreeSortMode,
  });

  return relativePath;
}

export function createFileSystemCreateActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<
  FileSystemSlice,
  'createNote' | 'createNoteWithContent' | 'createFolder' | 'clearNewlyCreatedFolder'
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
            kind: notesPath ? 'vault' : 'scratch',
            openTabs,
            currentNote,
            currentNoteRevision,
            noteContentsCache,
            draftNotes,
            displayNames,
          });
          set(nextState);
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
          const currentVaultPath = getCurrentVaultPath();
          if (!currentVaultPath) {
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
            set(nextState);
            return draftPath;
          }

          notesPath = currentVaultPath;
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
        const latestRecentNotes = addToRecentNotes(result.relativePath, latestState.recentNotes);

        return finalizeCreatedNote({
          set,
          notesPath,
          relativePath: result.relativePath,
          content: result.content,
          fileName: result.fileName,
          updatedMetadata: latestMetadata,
          folderPath,
          recentNotes: latestRecentNotes,
          modifiedAt: result.modifiedAt,
          size: result.size,
          fileTreeSortMode: latestState.fileTreeSortMode ?? fileTreeSortMode,
          noteContentsCache: latestState.noteContentsCache,
          openTabs: latestState.openTabs,
          currentNote: latestState.currentNote,
          currentRootFolder: latestRootFolder,
        });
      } catch (error) {
        if (notesPathForError && !isActiveNotesPath(get, notesPathForError)) {
          throw error;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to create note' });
        throw error;
      }
    },

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
        const latestRecentNotes = addToRecentNotes(result.relativePath, latestState.recentNotes);

        return finalizeCreatedNote({
          set,
          notesPath,
          relativePath: result.relativePath,
          content: result.content,
          fileName: result.fileName,
          updatedMetadata: latestMetadata,
          folderPath,
          recentNotes: latestRecentNotes,
          modifiedAt: result.modifiedAt,
          size: result.size,
          fileTreeSortMode: latestState.fileTreeSortMode ?? fileTreeSortMode,
          noteContentsCache: latestState.noteContentsCache,
          openTabs: latestState.openTabs,
          currentNote: latestState.currentNote,
          currentRootFolder: latestRootFolder,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          throw error;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to create note' });
        throw error;
      }
    },

    createFolder: async (parentPath: string, name?: string) => {
      let {
        notesPath,
        fileTreeSortMode,
        noteMetadata,
      } = get();
      const storage = getStorageAdapter();

      try {
        if (!notesPath) {
          const currentVaultPath = getCurrentVaultPath();
          if (!currentVaultPath) {
            return null;
          }

          notesPath = currentVaultPath;
          await ensureNotesFolder(notesPath);
          set({ notesPath });
        }

        const { relativePath, fullPath, fileName } = await resolveUniquePath(
          notesPath,
          parentPath || undefined,
          name || 'Untitled',
          true,
        );

        markExpectedExternalChange(fullPath, true);
        await storage.mkdir(fullPath, true);
        if (!isActiveNotesPath(get, notesPath)) {
          return relativePath;
        }

        const latestState = get();
        const latestRootFolder = ensureRootFolderState(latestState.rootFolder);
        const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
        const nextRootFolder = buildSortedRootFolder(
          latestRootFolder,
          addNodeToTree(latestRootFolder.children, parentPath, {
            id: relativePath,
            name: fileName,
            path: relativePath,
            isFolder: true,
            children: [],
            expanded: false,
          }),
          latestSortMode,
          latestState.noteMetadata ?? noteMetadata,
        );

        set({
          rootFolder: nextRootFolder,
          newlyCreatedFolderPath: !name ? relativePath : null,
        });
        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: latestState.currentNote?.path ?? null,
          fileTreeSortMode: latestSortMode,
        });
        return relativePath;
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return null;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to create folder' });
        return null;
      }
    },

    clearNewlyCreatedFolder: () => set({ newlyCreatedFolderPath: null }),
  };
}
