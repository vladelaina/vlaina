/** Notes Store - Re-export from refactored location */

export { 
  useNotesStore, 
  setCurrentVaultPath, 
  getCurrentVaultPath, 
  sortFileTree 
} from './notes';

export type { 
  NoteFile, 
  FolderNode, 
  FileTreeNode, 
  NotesState, 
  NotesActions, 
  NotesStore 
} from './notes';
