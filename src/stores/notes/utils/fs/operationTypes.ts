import type { NotesStore } from '../../types';
import type { RecoverableDeletedItem } from './trashOperations';

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
  sourcePath: string;
  newPath: string;
}

export interface MoveItemResult {
  sourcePath: string;
  newPath: string;
  targetFolderPath: string;
}

export interface DeleteOperationResult {
  updatedTabs: NotesStore['openTabs'];
  nextAction: FileOperationNextAction;
  newChildren: FileTreeChildren;
  recoverableDelete: RecoverableDeletedItem;
}
