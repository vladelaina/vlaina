export const NOTE_SOURCE_MODE_TOGGLE_EVENT = 'note-source-mode-toggle';

export function dispatchNoteSourceModeToggleEvent() {
  window.dispatchEvent(new Event(NOTE_SOURCE_MODE_TOGGLE_EVENT));
}
