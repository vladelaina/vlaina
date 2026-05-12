import {
  canAutoSaveDraftNote,
  hasDraftUnsavedChanges,
  isDraftNotePath,
} from './draftNote';
import { flushCurrentPendingEditorMarkdown } from './pendingEditorMarkdownFlusher';
import { useNotesStore } from '../useNotesStore';
import { openStoredNotePath } from './openNotePath';

export function getUnsavedDraftPaths(filter?: (path: string) => boolean) {
  const notesState = useNotesStore.getState();
  const draftPaths = new Set<string>();

  notesState.openTabs.forEach((tab) => {
    if (isDraftNotePath(tab.path)) {
      draftPaths.add(tab.path);
    }
  });

  if (isDraftNotePath(notesState.currentNote?.path)) {
    draftPaths.add(notesState.currentNote.path);
  }

  Object.keys(notesState.draftNotes).forEach((path) => {
    if (isDraftNotePath(path)) {
      draftPaths.add(path);
    }
  });

  return Array.from(draftPaths).flatMap((draftPath) => {
    if (filter && !filter(draftPath)) {
      return [];
    }

    const draftEntry = notesState.draftNotes[draftPath];
    const draftContent = notesState.currentNote?.path === draftPath
      ? notesState.currentNote.content ?? notesState.noteContentsCache.get(draftPath)?.content ?? ''
      : notesState.noteContentsCache.get(draftPath)?.content ?? '';
    const draftMetadata = notesState.noteMetadata?.notes[draftPath];

    return hasDraftUnsavedChanges({
      draftName: draftEntry?.name,
      content: draftContent,
      metadata: draftMetadata,
    }) ? [draftPath] : [];
  });
}

export function getAutoSaveableDraftPaths() {
  const notesState = useNotesStore.getState();
  return getUnsavedDraftPaths(
    (draftPath) => canAutoSaveDraftNote(notesState.notesPath, notesState.draftNotes[draftPath])
  );
}

export function getDiscardableDraftPaths() {
  const notesState = useNotesStore.getState();
  return getUnsavedDraftPaths(
    (draftPath) => !canAutoSaveDraftNote(notesState.notesPath, notesState.draftNotes[draftPath])
  );
}

export async function saveAutoSaveableDrafts() {
  const originalPath = useNotesStore.getState().currentNote?.path ?? null;
  const restoreOriginalPath = async () => {
    if (!originalPath) {
      return;
    }

    const latestState = useNotesStore.getState();
    if (latestState.currentNote?.path === originalPath) {
      return;
    }

    if (isDraftNotePath(originalPath) && !latestState.draftNotes[originalPath]) {
      return;
    }

    const canRestoreOriginal =
      latestState.openTabs.some((tab) => tab.path === originalPath) ||
      latestState.noteContentsCache.has(originalPath);
    if (!canRestoreOriginal) {
      return;
    }

    await openStoredNotePath(originalPath, {
      openNote: latestState.openNote,
      openNoteByAbsolutePath: latestState.openNoteByAbsolutePath,
    });
  };

  try {
    flushCurrentPendingEditorMarkdown();

    for (const draftPath of getAutoSaveableDraftPaths()) {
      const latestState = useNotesStore.getState();
      if (latestState.currentNote?.path !== draftPath) {
        await latestState.openNote(draftPath);
      }

      const currentState = useNotesStore.getState();
      if (currentState.currentNote?.path !== draftPath || !currentState.draftNotes[draftPath]) {
        await restoreOriginalPath();
        return false;
      }

      await currentState.saveNote({ suppressOpenTarget: true });

      if (useNotesStore.getState().draftNotes[draftPath]) {
        await restoreOriginalPath();
        return false;
      }
    }

    await restoreOriginalPath();
    return true;
  } catch {
    await restoreOriginalPath();
    return false;
  }
}
