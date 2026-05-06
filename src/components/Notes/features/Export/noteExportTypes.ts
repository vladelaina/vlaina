export type NoteExportFormat = 'docx' | 'html' | 'pdf' | 'png';

export interface NoteExportRequest {
  format: NoteExportFormat;
  markdown: string;
  notePath: string;
  notesPath: string;
  title: string;
}

export interface NoteExportResult {
  canceled: boolean;
  filePath?: string;
}
