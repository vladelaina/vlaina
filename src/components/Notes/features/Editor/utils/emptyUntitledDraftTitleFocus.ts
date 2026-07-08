import { requestNativeCaretOverlayRefresh } from '@/hooks/useNativeCaretOverlay';
import { useNotesStore } from '@/stores/useNotesStore';
import type { NoteMetadataEntry } from '@/stores/notes/types';
import { isEmptyUntitledDraft } from '../../../notesViewHelpers';
import { focusNoteTitleInputAtEnd } from './titleInputDom';

export function shouldFocusEmptyUntitledDraftTitle({
  content,
  draftMetadata,
  draftNotes,
  path,
}: {
  content: string;
  draftMetadata?: NoteMetadataEntry;
  draftNotes: ReturnType<typeof useNotesStore.getState>['draftNotes'];
  path: string | null | undefined;
}): boolean {
  return isEmptyUntitledDraft({
    content,
    draftMetadata,
    draftNotes,
    path,
  });
}

export function shouldFocusCurrentEmptyUntitledDraftTitle(): boolean {
  const state = useNotesStore.getState();
  const currentNote = state.currentNote;
  const currentNotePath = currentNote?.path;

  return shouldFocusEmptyUntitledDraftTitle({
    content: currentNote?.content ?? '',
    draftMetadata: currentNotePath ? state.noteMetadata?.notes[currentNotePath] : undefined,
    draftNotes: state.draftNotes,
    path: currentNotePath,
  });
}

export function focusEmptyUntitledDraftTitle(root: ParentNode = document): boolean {
  if (!focusNoteTitleInputAtEnd(root)) {
    return false;
  }

  requestNativeCaretOverlayRefresh();
  return true;
}

export function focusCurrentEmptyUntitledDraftTitle(root: ParentNode = document): boolean {
  if (!shouldFocusCurrentEmptyUntitledDraftTitle()) {
    return false;
  }

  return focusEmptyUntitledDraftTitle(root);
}
