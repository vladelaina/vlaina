import { useNotesStore } from '@/stores/useNotesStore';
import { isDraftNotePath } from './draftNote';
import { openStoredNotePath } from './openNotePath';
import { flushCurrentPendingEditorMarkdown } from './pendingEditorMarkdownFlusher';

export async function saveDirtyRegularOpenTabs(): Promise<boolean> {
  flushCurrentPendingEditorMarkdown();

  const initialState = useNotesStore.getState();
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
      return false;
    }

    await focusedState.saveNote();

    const afterSaveState = useNotesStore.getState();
    const tabStillDirty = afterSaveState.openTabs.some(
      (tab) => tab.path === path && tab.isDirty
    );
    const currentStillDirty = afterSaveState.currentNote?.path === path && afterSaveState.isDirty;
    if (tabStillDirty || currentStillDirty) {
      return false;
    }
  }

  return true;
}
