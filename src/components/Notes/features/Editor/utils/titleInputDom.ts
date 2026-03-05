export const NOTE_TITLE_INPUT_DATA_ATTR = 'data-note-title-input';
export const NOTE_TITLE_INPUT_SELECTOR = `input[${NOTE_TITLE_INPUT_DATA_ATTR}="true"]`;

export function getNoteTitleInput(root: ParentNode = document): HTMLInputElement | null {
  return root.querySelector<HTMLInputElement>(NOTE_TITLE_INPUT_SELECTOR);
}

export function focusNoteTitleInputAtEnd(root: ParentNode = document): boolean {
  const input = getNoteTitleInput(root);
  if (!input) return false;

  input.focus();
  const length = input.value.length;
  input.setSelectionRange(length, length);
  return true;
}
