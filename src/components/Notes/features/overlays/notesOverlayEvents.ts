export type NotesOverlaySource =
  | 'cover-picker'
  | 'header-icon-picker'
  | 'selection-toolbar'
  | 'emoji-shortcut'
  | 'slash-menu'
  | 'slash-emoji-picker'
  | 'slash-image-library';

const NOTES_OVERLAY_OPEN_EVENT = 'app:notes-overlay-open';

export interface NotesOverlayOpenDetail {
  source: NotesOverlaySource;
}

export function notifyNotesOverlayOpen(source: NotesOverlaySource) {
  const dispatch = () => {
    try {
      document.dispatchEvent(
        new CustomEvent<NotesOverlayOpenDetail>(NOTES_OVERLAY_OPEN_EVENT, {
          detail: { source },
        })
      );
    } catch {
    }
  };

  if (typeof queueMicrotask === 'function') {
    queueMicrotask(dispatch);
    return;
  }

  void Promise.resolve().then(dispatch).catch(() => undefined);
}

export function onNotesOverlayOpen(
  listener: (detail: NotesOverlayOpenDetail) => void
) {
  const handleOpen = (event: Event) => {
    const detail = (event as CustomEvent<NotesOverlayOpenDetail>).detail;
    if (!detail?.source) return;
    listener(detail);
  };

  document.addEventListener(NOTES_OVERLAY_OPEN_EVENT, handleOpen);
  return () => document.removeEventListener(NOTES_OVERLAY_OPEN_EVENT, handleOpen);
}
