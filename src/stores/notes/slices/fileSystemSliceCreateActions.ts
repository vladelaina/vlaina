import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getStorageAdapter } from '@/lib/storage/adapter';
import type { NotesStore } from '../types';
import { addNodeToTree } from '../fileTreeUtils';
import {
  createEmptyMetadataFile,
  ensureNotesFolder,
  getCurrentVaultPath,
  getNotesBasePath,
  addToRecentNotes,
  mergeNoteMetadataWithFileInfo,
  setNoteEntry,
} from '../storage';
import { createNoteImpl } from '../utils/fs/crudOperations';
import { getParentPath, resolveUniquePath } from '../utils/fs/pathOperations';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { setCachedNoteContent } from '../document/noteContentCache';
import { loadNoteDocument } from '../document/noteDocumentPersistence';
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
  recentNotes: NotesStore['recentNotes'];
  modifiedAt: CreateNoteResult['modifiedAt'];
  size: CreateNoteResult['size'];
  fileTreeSortMode: NotesStore['fileTreeSortMode'];
  noteContentsCache: NotesStore['noteContentsCache'];
  openTabs: NotesStore['openTabs'];
  currentNote: NotesStore['currentNote'];
  currentRootFolder: NonNullable<NotesStore['rootFolder']>;
}) {
  const parentPath = relativePath.includes('/')
    ? relativePath.slice(0, relativePath.lastIndexOf('/'))
    : undefined;
  const nextRootFolder = buildSortedRootFolder(
    currentRootFolder,
    addNodeToTree(currentRootFolder.children, parentPath, {
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

    duplicateNote: async (path: string) => {
      let notesPathForError = '';
      try {
        let {
          notesPath,
          rootFolder,
          fileTreeSortMode,
        } = await ensureCurrentNoteSaved(get, { skipDraft: true });
        notesPathForError = notesPath;

        if (!notesPath) {
          const currentVaultPath = getCurrentVaultPath();
          if (!currentVaultPath) {
            throw new Error('Notes path is not available');
          }

          notesPath = currentVaultPath;
          notesPathForError = notesPath;
          await ensureNotesFolder(notesPath);
          set({ notesPath });
        }

        const storage = getStorageAdapter();
        const { relativePath: sourcePath, fullPath: sourceFullPath } =
          await resolveVaultRelativeFullPath(notesPath, path);
        if (!isSupportedMarkdownPath(sourcePath)) {
          throw new Error('Only Markdown files can be duplicated as notes.');
        }
        if (hasInternalNotePathSegment(sourcePath)) {
          throw new Error('Path must not be inside an internal notes folder.');
        }

        const sourceName = sourcePath.split('/').filter(Boolean).pop() || 'Untitled.md';
        const parentPath = getParentPath(sourcePath) || undefined;
        const {
          relativePath: duplicatePath,
          fullPath: duplicateFullPath,
          fileName,
        } = await resolveUniquePath(notesPath, parentPath, sourceName, false);

        markExpectedExternalChange(duplicateFullPath);
        await storage.copyFile(sourceFullPath, duplicateFullPath);
        if (!isActiveNotesPath(get, notesPath)) {
          return duplicatePath;
        }

        const duplicateFileInfo = await storage.stat(duplicateFullPath).catch(() => null);
        const duplicateTitle = getNoteTitleFromPath(fileName);
        const buildDuplicateTreeState = (
          latestState: NotesStore,
          duplicateMetadata: Parameters<typeof setNoteEntry>[2],
        ) => {
          const latestRootFolder = ensureRootFolderState(latestState.rootFolder ?? rootFolder);
          const latestMetadata = setNoteEntry(
            latestState.noteMetadata ?? createEmptyMetadataFile(),
            duplicatePath,
            duplicateMetadata,
          );
          const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
          const nextRootFolder = buildSortedRootFolder(
            latestRootFolder,
            addNodeToTree(latestRootFolder.children, parentPath, {
              id: duplicatePath,
              name: duplicateTitle,
              path: duplicatePath,
              isFolder: false,
            }),
            latestSortMode,
            latestMetadata,
          );
          const updatedRecentNotes = addToRecentNotes(duplicatePath, latestState.recentNotes);

          return {
            latestMetadata,
            latestSortMode,
            nextRootFolder,
            updatedRecentNotes,
          };
        };

        let loaded: Awaited<ReturnType<typeof loadNoteDocument>>;
        const latestState = get();
        try {
          loaded = await loadNoteDocument({
            notesPath,
            path: duplicatePath,
            cache: latestState.noteContentsCache,
          });
        } catch (openError) {
          if (!isActiveNotesPath(get, notesPath)) {
            return duplicatePath;
          }

          const latestStateAfterOpenError = get();
          const fallbackMetadata = mergeNoteMetadataWithFileInfo(
            latestStateAfterOpenError.noteMetadata?.notes[sourcePath],
            duplicateFileInfo,
          );
          const {
            latestMetadata,
            latestSortMode,
            nextRootFolder,
            updatedRecentNotes,
          } = buildDuplicateTreeState(latestStateAfterOpenError, fallbackMetadata);

          set({
            rootFolder: nextRootFolder,
            noteMetadata: latestMetadata,
            recentNotes: updatedRecentNotes,
            isNewlyCreated: false,
            error: openError instanceof Error ? openError.message : 'Failed to open duplicated note',
          });

          persistWorkspaceSnapshot(notesPath, {
            rootFolder: nextRootFolder,
            currentNotePath: latestStateAfterOpenError.currentNote?.path ?? null,
            fileTreeSortMode: latestSortMode,
          });

          return duplicatePath;
        }
        if (!isActiveNotesPath(get, notesPath)) {
          return duplicatePath;
        }

        const latestStateAfterLoad = get();
        const {
          latestMetadata,
          latestSortMode,
          nextRootFolder,
          updatedRecentNotes,
        } = buildDuplicateTreeState(latestStateAfterLoad, loaded.metadata);
        const updatedTabs = replaceCurrentTabOrAppend(
          latestStateAfterLoad.openTabs,
          latestStateAfterLoad.currentNote?.path,
          {
            path: duplicatePath,
            name: duplicateTitle,
            isDirty: false,
          },
        );
        const nextNoteContentsCache = setCachedNoteContent(
          latestStateAfterLoad.noteContentsCache,
          duplicatePath,
          loaded.content,
          loaded.modifiedAt,
          {
            updateBaseline: true,
            size: loaded.size,
          },
        );

        set({
          rootFolder: nextRootFolder,
          noteMetadata: latestMetadata,
          currentNote: { path: duplicatePath, content: loaded.content },
          currentNoteRevision: latestStateAfterLoad.currentNoteRevision + 1,
          isDirty: false,
          openTabs: updatedTabs,
          recentNotes: updatedRecentNotes,
          isNewlyCreated: false,
          error: null,
          noteContentsCache: nextNoteContentsCache,
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: duplicatePath,
          fileTreeSortMode: latestSortMode,
        });

        return duplicatePath;
      } catch (error) {
        if (notesPathForError && !isActiveNotesPath(get, notesPathForError)) {
          throw error;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to duplicate note' });
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
