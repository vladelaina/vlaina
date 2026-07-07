import { getCurrentNotesRootPath } from '../storage';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import type { FileSystemSliceGet } from './fileSystemSliceContracts';

export function isActiveNotesPath(get: FileSystemSliceGet, notesPath: string) {
  return get().notesPath === notesPath;
}

export async function ensureCurrentNoteSaved(get: FileSystemSliceGet, options?: { skipDraft?: boolean }) {
  flushCurrentPendingEditorMarkdown();
  const state = get();
  if (!state.isDirty) {
    return state;
  }

  if (options?.skipDraft && state.currentNote && state.draftNotes[state.currentNote.path]) {
    return state;
  }

  await state.saveNote();

  return get();
}

export function getStateAfterFlushingCurrentNote(get: FileSystemSliceGet) {
  flushCurrentPendingEditorMarkdown();
  return get();
}

export function getCurrentNotesRootPathForCreate() {
  return getCurrentNotesRootPath();
}
