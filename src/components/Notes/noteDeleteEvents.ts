export const DELETE_CURRENT_NOTE_EVENT = 'vlaina-delete-current-note';

export function dispatchDeleteCurrentNoteEvent() {
  window.dispatchEvent(new Event(DELETE_CURRENT_NOTE_EVENT));
}

export function subscribeDeleteCurrentNoteEvent(listener: () => void): () => void {
  window.addEventListener(DELETE_CURRENT_NOTE_EVENT, listener);
  return () => window.removeEventListener(DELETE_CURRENT_NOTE_EVENT, listener);
}
