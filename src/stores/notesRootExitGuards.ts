import { saveAutoSaveableDrafts } from '@/stores/notes/autoSaveableDrafts';
import { saveDirtyRegularOpenTabs } from '@/stores/notes/dirtyOpenTabs';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { useNotesStore } from './useNotesStore';

function hasUnsavedDraftTabs(): boolean {
  const notesState = useNotesStore.getState();
  const draftPaths = new Set(
    notesState.openTabs
      .filter((tab) => isDraftNotePath(tab.path))
      .map((tab) => tab.path)
  );

  if (isDraftNotePath(notesState.currentNote?.path)) {
    draftPaths.add(notesState.currentNote.path);
  }

  Object.keys(notesState.draftNotes).forEach((path) => {
    if (isDraftNotePath(path)) {
      draftPaths.add(path);
    }
  });

  for (const draftPath of draftPaths) {
    const draftEntry = notesState.draftNotes[draftPath];
    const draftContent = notesState.currentNote?.path === draftPath
      ? notesState.currentNote.content
      : notesState.noteContentsCache.get(draftPath)?.content ?? '';
    const draftMetadata = notesState.noteMetadata?.notes[draftPath];
    if (
      hasDraftUnsavedChanges({
        draftName: draftEntry?.name,
        content: draftContent,
        metadata: draftMetadata,
      })
    ) {
      return true;
    }
  }

  return false;
}

export async function prepareNotesForNotesRootExit(
  options: { blockUnsavedDrafts?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const savedAutoSaveableDrafts = await saveAutoSaveableDrafts();
  if (!savedAutoSaveableDrafts) {
    return { ok: false, error: 'Failed to save pending draft changes' };
  }

  const savedDirtyTabs = await saveDirtyRegularOpenTabs();
  const notesState = useNotesStore.getState();
  const hasDirtyRegularTabs = notesState.openTabs.some(
    (tab) => tab.isDirty && !isDraftNotePath(tab.path)
  );
  const currentRegularStillDirty =
    notesState.isDirty && !isDraftNotePath(notesState.currentNote?.path);

  if (!savedDirtyTabs || hasDirtyRegularTabs || currentRegularStillDirty) {
    return { ok: false, error: 'Failed to save pending note changes' };
  }

  if (options.blockUnsavedDrafts !== false && hasUnsavedDraftTabs()) {
    return { ok: false, error: 'Save or discard draft notes before opening another folder' };
  }

  return { ok: true };
}
