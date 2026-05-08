import { canAutoSaveDraftNote, isDraftNotePath } from '@/stores/notes/draftNote';
import type { DraftNoteEntry } from '@/stores/notes/types';

interface DirtyTabIndicatorInput {
  path: string;
  isDirty: boolean;
  isActive: boolean;
  notesPath: string;
  draftNote?: DraftNoteEntry;
  hasSaveError: boolean;
}

export function shouldShowDirtyTabIndicator({
  path,
  isDirty,
  isActive,
  notesPath,
  draftNote,
  hasSaveError,
}: DirtyTabIndicatorInput) {
  if (!isDirty) {
    return false;
  }

  if (!isActive) {
    return true;
  }

  if (hasSaveError) {
    return true;
  }

  if (isDraftNotePath(path)) {
    return !canAutoSaveDraftNote(notesPath, draftNote);
  }

  return false;
}
