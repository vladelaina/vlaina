import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { NotesStore } from '../types';
import { addNodeToTree } from '../fileTreeUtils';
import { addToRecentNotes } from '../storage';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { setCachedNoteContent } from '../document/noteContentCache';
import { pushNoteNavigationHistory } from '../document/noteNavigationHistory';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { replaceCurrentTabOrAppend } from './fileSystemSliceHelpers';
import type { FileSystemSliceSet } from './fileSystemSliceContracts';

type CreatedNoteResult = {
  content: string;
  fileName: string;
  modifiedAt: number | null;
  relativePath: string;
  size: number | null;
};

export function finalizeCreatedNote({
  set,
  notesPath,
  result,
  updatedMetadata,
  fileTreeSortMode,
  noteContentsCache,
  openTabs,
  currentNote,
  currentRootFolder,
  navigationState,
}: {
  set: FileSystemSliceSet;
  notesPath: string;
  result: CreatedNoteResult;
  updatedMetadata: NotesStore['noteMetadata'];
  fileTreeSortMode: NotesStore['fileTreeSortMode'];
  noteContentsCache: NotesStore['noteContentsCache'];
  openTabs: NotesStore['openTabs'];
  currentNote: NotesStore['currentNote'];
  currentRootFolder: NonNullable<NotesStore['rootFolder']>;
  navigationState: Pick<NotesStore, 'currentNote' | 'noteNavigationHistory' | 'noteNavigationHistoryIndex' | 'recentNotes'>;
}) {
  const { relativePath, content, fileName, modifiedAt, size } = result;
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
  const recentNotes = addToRecentNotes(relativePath, navigationState.recentNotes);

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
    ...pushNoteNavigationHistory(navigationState, relativePath),
  });

  persistWorkspaceSnapshot(notesPath, {
    rootFolder: nextRootFolder,
    currentNotePath: relativePath,
    fileTreeSortMode,
  });

  return relativePath;
}
