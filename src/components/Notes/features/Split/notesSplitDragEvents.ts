export const NOTES_TAB_SPLIT_DRAG_EVENT = 'notes:tab-split-drag';

export type NotesTabSplitDragPhase = 'start' | 'move' | 'end' | 'cancel';
export type NotesSplitDragSource = 'tab' | 'sidebar';

export interface NotesTabSplitDragDetail {
  phase: NotesTabSplitDragPhase;
  path: string;
  source?: NotesSplitDragSource;
  clientX?: number;
  clientY?: number;
}

export function dispatchNotesTabSplitDrag(detail: NotesTabSplitDragDetail): boolean {
  const event = new CustomEvent<NotesTabSplitDragDetail>(NOTES_TAB_SPLIT_DRAG_EVENT, {
    cancelable: true,
    detail,
  });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

export function subscribeNotesTabSplitDrag(
  listener: (detail: NotesTabSplitDragDetail) => boolean | void
): () => void {
  const handleEvent = (event: Event) => {
    const handled = listener((event as CustomEvent<NotesTabSplitDragDetail>).detail);
    if (handled) {
      event.preventDefault();
    }
  };

  window.addEventListener(NOTES_TAB_SPLIT_DRAG_EVENT, handleEvent);
  return () => {
    window.removeEventListener(NOTES_TAB_SPLIT_DRAG_EVENT, handleEvent);
  };
}
