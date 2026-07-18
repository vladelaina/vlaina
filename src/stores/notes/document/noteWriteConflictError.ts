export type NoteWriteConflictReason =
  | 'conditional-write-rejected'
  | 'merge-conflict'
  | 'missing-cache-baseline';

export class NoteWriteConflictError extends Error {
  readonly conflictReason: NoteWriteConflictReason;

  constructor(conflictReason: NoteWriteConflictReason = 'conditional-write-rejected') {
    super('Current note changed on disk. Reload or resolve the conflict before saving.');
    this.name = 'NoteWriteConflictError';
    this.conflictReason = conflictReason;
  }
}
