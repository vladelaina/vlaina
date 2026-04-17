import { getStateForPathDeletion, getStateForPathRename } from '../utils/fs/pathStateEffects';
import { persistRecentNotes } from '../storage';
import { setCachedNoteContent } from '../document/noteContentCache';
import { createDraftNotePath } from '../draftNote';
import type { NotesStore } from '../types';

export function isPathWithinFolder(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

export function ensureRootFolderState(
  rootFolder: NotesStore['rootFolder'],
): NonNullable<NotesStore['rootFolder']> {
  return (
    rootFolder ?? {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      children: [],
      expanded: true,
    }
  );
}

export function replaceCurrentTabOrAppend(
  openTabs: NotesStore['openTabs'],
  currentNotePath: string | null | undefined,
  nextTab: NotesStore['openTabs'][number],
) {
  if (!currentNotePath) {
    return [...openTabs, nextTab];
  }

  const currentTabIndex = openTabs.findIndex((tab) => tab.path === currentNotePath);
  if (currentTabIndex === -1) {
    return [...openTabs, nextTab];
  }

  const nextTabs = [...openTabs];
  nextTabs[currentTabIndex] = nextTab;
  return nextTabs;
}

export function createBlankDraftState({
  folderPath,
  openTabs,
  currentNote,
  currentNoteRevision,
  noteContentsCache,
  draftNotes,
  displayNames,
}: {
  folderPath?: string;
  openTabs: NotesStore['openTabs'];
  currentNote: NotesStore['currentNote'];
  currentNoteRevision: NotesStore['currentNoteRevision'];
  noteContentsCache: NotesStore['noteContentsCache'];
  draftNotes: NotesStore['draftNotes'];
  displayNames: NotesStore['displayNames'];
}) {
  const draftPath = createDraftNotePath();
  const nextTab = { path: draftPath, name: '', isDirty: false };
  const nextDisplayNames = new Map(displayNames);
  nextDisplayNames.set(draftPath, '');

  return {
    draftPath,
    nextState: {
      currentNote: { path: draftPath, content: '' },
      currentNoteRevision: currentNoteRevision + 1,
      isDirty: false,
      openTabs: replaceCurrentTabOrAppend(openTabs, currentNote?.path, nextTab),
      isNewlyCreated: true,
      error: null,
      noteContentsCache: setCachedNoteContent(noteContentsCache, draftPath, '', null),
      draftNotes: {
        ...draftNotes,
        [draftPath]: {
          parentPath: folderPath ?? null,
          name: '',
        },
      },
      displayNames: nextDisplayNames,
    },
  };
}

export function applyPathDeletionState({
  path,
  recentNotes,
  displayNames,
  noteContentsCache,
}: {
  path: string;
  recentNotes: NotesStore['recentNotes'];
  displayNames: NotesStore['displayNames'];
  noteContentsCache: NotesStore['noteContentsCache'];
}) {
  const nextState = getStateForPathDeletion({
    path,
    recentNotes,
    displayNames,
    noteContentsCache,
  });

  if (nextState.nextRecentNotes !== recentNotes) {
    persistRecentNotes(nextState.nextRecentNotes);
  }

  return nextState;
}

export function applyPathRenameState({
  oldPath,
  newPath,
  recentNotes,
  displayNames,
  noteContentsCache,
}: {
  oldPath: string;
  newPath: string;
  recentNotes: NotesStore['recentNotes'];
  displayNames: NotesStore['displayNames'];
  noteContentsCache: NotesStore['noteContentsCache'];
}) {
  const nextState = getStateForPathRename({
    oldPath,
    newPath,
    recentNotes,
    displayNames,
    noteContentsCache,
  });

  if (nextState.nextRecentNotes !== recentNotes) {
    persistRecentNotes(nextState.nextRecentNotes);
  }

  return nextState;
}
