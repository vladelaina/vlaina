export interface AssetContext {
  notesRootPath: string;
  currentNotePath?: string;
}

export interface AssetConfig {
  storageMode: 'notesRoot' | 'notesRootSubfolder' | 'currentFolder' | 'subfolder';
  subfolderName?: string;
  imageNotesRootSubfolderName?: string;
  filenameFormat: 'original' | 'timestamp' | 'sequence';
}
