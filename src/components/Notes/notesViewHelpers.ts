import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { NoteMetadataEntry } from '@/stores/notes/types';

export const FLOATING_CHAT_VIEWPORT_MARGIN_PX = 32;
export const SPLIT_PANE_DRAG_THRESHOLD_PX = 5;

export function scheduleSidebarScroll(path: string): void {
  void import('./features/common/sidebarScrollIntoView')
    .then((mod) => {
      mod.scheduleSidebarItemIntoView(path, 2);
    });
}

export function isEmptyUntitledDraft({
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
  if (!path || !isDraftNotePath(path)) {
    return false;
  }

  const draftEntry = draftNotes[path];
  if (!draftEntry) {
    return false;
  }

  return !hasDraftUnsavedChanges({
    draftName: draftEntry.name,
    content,
    metadata: draftMetadata,
  });
}

export function isNotePathOpenInLatestTabs(path: string): boolean {
  return useNotesStore.getState().openTabs.some((tab) => tab.path === path);
}
