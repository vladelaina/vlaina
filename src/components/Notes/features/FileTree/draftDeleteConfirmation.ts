import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import type { NotesStore } from '@/stores/useNotesStore';

type DraftDeletionState = Pick<
  NotesStore,
  'currentNote' | 'draftNotes' | 'noteContentsCache' | 'noteMetadata'
>;

export function canDeleteDraftWithoutConfirmation(path: string, state: DraftDeletionState): boolean {
  if (!isDraftNotePath(path)) {
    return false;
  }

  const draftNote = state.draftNotes[path];
  if (!draftNote) {
    return false;
  }

  const content = state.currentNote?.path === path
    ? state.currentNote.content
    : state.noteContentsCache.get(path)?.content ?? '';

  return !hasDraftUnsavedChanges({
    draftName: draftNote.name,
    content,
    metadata: state.noteMetadata?.notes[path],
  });
}
