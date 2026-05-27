import { describe, expect, it } from 'vitest';
import {
  isEditableShortcutTarget,
  shouldSkipShortcutForEditableSystemShortcut,
} from './editableGuards';

function keydown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

describe('editable shortcut guards', () => {
  it('recognizes editable targets beyond explicit contenteditable=true', () => {
    const editor = document.createElement('div');
    editor.setAttribute('contenteditable', 'plaintext-only');
    const child = document.createElement('span');
    editor.appendChild(child);

    expect(isEditableShortcutTarget(child)).toBe(true);
  });

  it('preserves common clipboard and undo shortcuts inside editable targets', () => {
    const input = document.createElement('textarea');
    document.body.appendChild(input);

    try {
      for (const event of [
        keydown({ key: 'c', ctrlKey: true }),
        keydown({ key: 'x', ctrlKey: true }),
        keydown({ key: 'v', ctrlKey: true }),
        keydown({ key: 'v', ctrlKey: true, shiftKey: true }),
        keydown({ key: 'z', ctrlKey: true }),
        keydown({ key: 'z', ctrlKey: true, shiftKey: true }),
        keydown({ key: 'y', ctrlKey: true }),
        keydown({ key: 'Insert', ctrlKey: true }),
        keydown({ key: 'Insert', shiftKey: true }),
        keydown({ key: 'Delete', shiftKey: true }),
      ]) {
        input.dispatchEvent(event);
        expect(shouldSkipShortcutForEditableSystemShortcut(event)).toBe(true);
      }
    } finally {
      input.remove();
    }
  });

  it('does not preserve non-system shortcuts or non-editable targets', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);

    try {
      const editableCustomShortcut = keydown({ key: 'k', ctrlKey: true });
      const nonEditableCopy = keydown({ key: 'c', ctrlKey: true });
      const input = document.createElement('input');
      document.body.appendChild(input);

      input.dispatchEvent(editableCustomShortcut);
      button.dispatchEvent(nonEditableCopy);

      expect(shouldSkipShortcutForEditableSystemShortcut(editableCustomShortcut)).toBe(false);
      expect(shouldSkipShortcutForEditableSystemShortcut(nonEditableCopy)).toBe(false);
      input.remove();
    } finally {
      button.remove();
    }
  });
});
