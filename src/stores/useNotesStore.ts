export { 
  useNotesStore, 
  setCurrentVaultPath, 
  getCurrentVaultPath, 
  sortFileTree 
} from './notes';

export type { 
  NoteFile, 
  FolderNode, 
  FileTreeSortMode,
  FileTreeNode, 
  NotesState, 
  NotesActions, 
  NotesStore 
} from './notes';
