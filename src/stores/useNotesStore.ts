export { 
  useNotesStore, 
  setCurrentNotesRootPath, 
  getCurrentNotesRootPath, 
  sortFileTree 
} from './notes';

export type { 
  NoteFile, 
  ImageFile,
  FolderNode, 
  FileTreeSortMode,
  FileTreeNode, 
  NotesState, 
  NotesActions, 
  NotesStore 
} from './notes';
