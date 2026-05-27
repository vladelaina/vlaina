export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest('[contenteditable]:not([contenteditable="false"]), .ProseMirror, .cm-editor')) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function shouldPreserveEditableSystemShortcut(event: KeyboardEvent): boolean {
  if (event.altKey) {
    return false;
  }

  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'insert') {
    return true;
  }

  if (!(event.ctrlKey || event.metaKey) && event.shiftKey) {
    return key === 'insert' || key === 'delete';
  }

  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }

  if (event.shiftKey) {
    return key === 'v' || key === 'z';
  }

  return key === 'a' || key === 'c' || key === 'v' || key === 'x' || key === 'y' || key === 'z';
}

export function shouldSkipShortcutForEditableSystemShortcut(event: KeyboardEvent): boolean {
  return shouldPreserveEditableSystemShortcut(event) && isEditableShortcutTarget(event.target);
}
