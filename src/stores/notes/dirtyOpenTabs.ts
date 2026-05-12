import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from './draftNote';
import { openStoredNotePath } from './openNotePath';
import { flushCurrentPendingEditorMarkdown } from './pendingEditorMarkdownFlusher';

export async function saveDirtyRegularOpenTabs(): Promise<boolean> {
  flushCurrentPendingEditorMarkdown();

  const initialState = useNotesStore.getState();
  const originalPath = initialState.currentNote?.path ?? null;
  const dirtyPaths = initialState.openTabs
    .filter((tab) => tab.isDirty && !isDraftNotePath(tab.path))
    .map((tab) => tab.path);
  const currentPath = initialState.currentNote?.path;
  if (
    initialState.isDirty &&
    currentPath &&
    !isDraftNotePath(currentPath) &&
    !dirtyPaths.includes(currentPath)
  ) {
    dirtyPaths.push(currentPath);
  }

  const restoreOriginalPath = async () => {
    if (!originalPath) {
      return;
    }

    const latestState = useNotesStore.getState();
    if (latestState.currentNote?.path === originalPath) {
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

  for (const path of dirtyPaths) {
    const latestState = useNotesStore.getState();
    const tabIsDirty = latestState.openTabs.some((tab) => tab.path === path && tab.isDirty);
    const currentNoteIsDirty =
      latestState.currentNote?.path === path &&
      latestState.isDirty &&
      !isDraftNotePath(latestState.currentNote.path);
    if (!tabIsDirty && !currentNoteIsDirty) {
      continue;
    }

    if (latestState.currentNote?.path !== path) {
      await openStoredNotePath(path, {
        openNote: latestState.openNote,
        openNoteByAbsolutePath: latestState.openNoteByAbsolutePath,
      });
    }

    const focusedState = useNotesStore.getState();
    if (focusedState.currentNote?.path !== path) {
      await restoreOriginalPath();
      return false;
    }

    await focusedState.saveNote();

    const afterSaveState = useNotesStore.getState();
    const tabStillDirty = afterSaveState.openTabs.some(
      (tab) => tab.path === path && tab.isDirty
    );
    const currentStillDirty = afterSaveState.currentNote?.path === path && afterSaveState.isDirty;
    if (tabStillDirty || currentStillDirty) {
      await restoreOriginalPath();
      return false;
    }
  }

  await restoreOriginalPath();
  return true;
}
