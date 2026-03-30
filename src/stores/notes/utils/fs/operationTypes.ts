import type { NotesStore } from '../../types';

export type NoteTabState = NotesStore['openTabs'][number];
export type FileTreeChildren = NonNullable<NotesStore['rootFolder']>['children'];
export type FileOperationNextAction = { type: 'open'; path: string } | null;

export interface FileOperationContext {
  currentNote: NotesStore['currentNote'];
  openTabs: NotesStore['openTabs'];
  rootFolder: NotesStore['rootFolder'];
  starredEntries: NotesStore['starredEntries'];
  noteMetadata: NotesStore['noteMetadata'];
}

export interface RenameNoteResult {
  newPath: string;
  updatedStarredEntries: NotesStore['starredEntries'];
  updatedStarredNotes: NotesStore['starredNotes'];
  updatedStarredFolders: NotesStore['starredFolders'];
  updatedMetadata: NotesStore['noteMetadata'];
  updatedTabs: NotesStore['openTabs'];
  updatedChildren: FileTreeChildren;
  nextCurrentNote: NotesStore['currentNote'];
}

export interface MoveItemResult {
  sourcePath: string;
  newPath: string;
  updatedStarredEntries: NotesStore['starredEntries'];
  updatedStarredFolders: NotesStore['starredFolders'];
  updatedStarredNotes: NotesStore['starredNotes'];
  updatedMetadata: NotesStore['noteMetadata'];
  updatedTabs: NotesStore['openTabs'];
  nextCurrentNote: NotesStore['currentNote'];
  newChildren: FileTreeChildren;
}

export interface DeleteOperationResult {
  updatedTabs: NotesStore['openTabs'];
  updatedStarredEntries: NotesStore['starredEntries'];
  updatedStarredNotes: NotesStore['starredNotes'];
  updatedStarredFolders: NotesStore['starredFolders'];
  nextAction: FileOperationNextAction;
  updatedMetadata: NotesStore['noteMetadata'];
  newChildren: FileTreeChildren;
}

export interface FolderRenameResult {
  newPath: string;
  updatedStarredEntries: NotesStore['starredEntries'];
  updatedStarredFolders: NotesStore['starredFolders'];
  updatedStarredNotes: NotesStore['starredNotes'];
  updatedTabs: NotesStore['openTabs'];
  updatedCurrentNote: NotesStore['currentNote'];
  updatedMetadata: NotesStore['noteMetadata'];
}
