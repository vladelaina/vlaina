import { describe, expect, it } from 'vitest';
import {
  createMathEditorElements,
} from './mathEditorPopupDom';

describe('mathEditorPopupDom', () => {
  it('creates a simplified math editor card with a textarea and actions', () => {
    const { card, content, textarea, actions, cancelButton, saveButton } =
      createMathEditorElements();

    expect(card.className).toBe('math-editor-card');
    expect(card.querySelector('.math-editor-header')).toBeNull();
    expect(card.querySelector('.math-editor-rail')).toBeNull();
    expect(content.className).toBe('math-editor-content');
    expect(textarea.className).toBe('math-editor-textarea');
    expect(actions.className).toBe('math-editor-footer');
    expect(cancelButton.getAttribute('aria-label')).toBe('Cancel');
    expect(saveButton.getAttribute('aria-label')).toBe('Save');
    expect(cancelButton.textContent).toBe('Cancel');
    expect(saveButton.textContent).toBe('Save');
    expect(content.contains(textarea)).toBe(true);
  });
});
