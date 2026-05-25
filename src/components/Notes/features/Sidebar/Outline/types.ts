export interface NotesOutlineHeading {
  id: string;
  level: number;
  text: string;
  from: number;
  to: number;
}

export type NotesOutlineView = 'workspace' | 'outline';
