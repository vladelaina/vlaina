import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { NotesStore } from '../types';
import { addNodeToTree } from '../fileTreeUtils';
import { ensureNotesFolder, getCurrentVaultPath, getNotesBasePath } from '../storage';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { resolveUniquePath } from '../utils/fs/pathOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { setCachedNoteContent } from '../document/noteContentCache';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { logNotesDebug } from '../debugLog';
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
  const state = get();
  if (!state.isDirty) {
    return state;
  }

  if (options?.skipDraft && state.currentNote && state.draftNotes[state.currentNote.path]) {
    return state;
  }

  await state.saveNote();
  if (get().isDirty) {
    throw new Error('Failed to save current note before creating a new note');
  }

  return get();
}

function finalizeCreatedNote({
  set,
  notesPath,
  relativePath,
  content,
  fileName,
  updatedMetadata,
  newChildren,
  updatedRecent,
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
  newChildren: CreateNoteResult['newChildren'];
  updatedRecent: CreateNoteResult['updatedRecent'];
  fileTreeSortMode: NotesStore['fileTreeSortMode'];
  noteContentsCache: NotesStore['noteContentsCache'];
  openTabs: NotesStore['openTabs'];
  currentNote: NotesStore['currentNote'];
  currentRootFolder: NonNullable<NotesStore['rootFolder']>;
}) {
  const nextRootFolder = buildSortedRootFolder(
    currentRootFolder,
    newChildren,
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
    recentNotes: updatedRecent,
    isNewlyCreated: true,
    noteContentsCache: setCachedNoteContent(noteContentsCache, relativePath, content, null),
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
      let {
        notesPath,
        openTabs,
        recentNotes,
        rootFolder,
        currentNote,
        fileTreeSortMode,
        noteContentsCache,
        noteMetadata,
        draftNotes,
        displayNames,
        currentNoteRevision,
      } = await ensureCurrentNoteSaved(get, { skipDraft: true });

      try {
        if (options?.asDraft) {
          logNotesDebug('notes:create-note:as-draft:start', {
            folderPath: folderPath ?? null,
            notesPath,
            currentNotePath: currentNote?.path ?? null,
            openTabsLength: openTabs.length,
            draftNotesLength: Object.keys(draftNotes).length,
            displayNamesLength: displayNames.size,
          });

          const { draftPath, nextState } = createBlankDraftState({
            folderPath,
            openTabs,
            currentNote,
            currentNoteRevision,
            noteContentsCache,
            draftNotes,
            displayNames,
          });
          set(nextState);
          logNotesDebug('notes:create-note:as-draft:created', {
            draftPath,
            nextCurrentNotePath: nextState.currentNote?.path ?? null,
            nextOpenTabsLength: nextState.openTabs.length,
            nextDraftNotesLength: Object.keys(nextState.draftNotes).length,
            nextDisplayNamesLength: nextState.displayNames.size,
          });
          return draftPath;
        }

        if (!notesPath) {
          const currentVaultPath = getCurrentVaultPath();
          if (!currentVaultPath) {
            const { draftPath, nextState } = createBlankDraftState({
              folderPath,
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
          await ensureNotesFolder(notesPath);
          set({ notesPath });
        }

        const currentRootFolder = ensureRootFolderState(rootFolder);
        const result = await createNoteImpl(notesPath, folderPath, undefined, '', {
          rootFolder: currentRootFolder,
          recentNotes,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return result.relativePath;
        }

        return finalizeCreatedNote({
          set,
          notesPath,
          relativePath: result.relativePath,
          content: result.content,
          fileName: result.fileName,
          updatedMetadata: result.updatedMetadata,
          newChildren: result.newChildren,
          updatedRecent: result.updatedRecent,
          fileTreeSortMode,
          noteContentsCache,
          openTabs,
          currentNote,
          currentRootFolder,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
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
        recentNotes,
        openTabs,
        currentNote,
        fileTreeSortMode,
        noteContentsCache,
        noteMetadata,
      } = await ensureCurrentNoteSaved(get);
      const storage = getStorageAdapter();

      try {
        if (!notesPath) {
          notesPath = await getNotesBasePath();
          await ensureNotesFolder(notesPath);
          set({ notesPath });
        }

        const currentRootFolder = ensureRootFolderState(rootFolder);
        if (folderPath) {
          const folderFullPath = await joinPath(notesPath, folderPath);
          if (!await storage.exists(folderFullPath)) {
            await storage.mkdir(folderFullPath, true);
          }
        }

        const result = await createNoteImpl(notesPath, folderPath, name, content, {
          rootFolder: currentRootFolder,
          recentNotes,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return result.relativePath;
        }

        return finalizeCreatedNote({
          set,
          notesPath,
          relativePath: result.relativePath,
          content: result.content,
          fileName: result.fileName,
          updatedMetadata: result.updatedMetadata,
          newChildren: result.newChildren,
          updatedRecent: result.updatedRecent,
          fileTreeSortMode,
          noteContentsCache,
          openTabs,
          currentNote,
          currentRootFolder,
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

        const currentRootFolder = ensureRootFolderState(get().rootFolder);
        const nextRootFolder = buildSortedRootFolder(
          currentRootFolder,
          addNodeToTree(currentRootFolder.children, parentPath, {
            id: relativePath,
            name: fileName,
            path: relativePath,
            isFolder: true,
            children: [],
            expanded: false,
          }),
          fileTreeSortMode,
          noteMetadata,
        );

        set({
          rootFolder: nextRootFolder,
          newlyCreatedFolderPath: !name ? relativePath : null,
        });
        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: get().currentNote?.path ?? null,
          fileTreeSortMode,
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
