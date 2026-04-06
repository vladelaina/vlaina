export const EDITOR_FIND_OPEN_EVENT = 'vlaina-editor-find-open';

export function dispatchEditorFindOpenEvent() {
  window.dispatchEvent(new Event(EDITOR_FIND_OPEN_EVENT));
}
