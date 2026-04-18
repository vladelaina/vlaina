import { describe, expect, it } from 'vitest';
import {
  createMathEditorElements,
} from './mathEditorPopupDom';

describe('mathEditorPopupDom', () => {
  it('creates a compact math editor card with an input and actions', () => {
    const { card, content, textarea, actions, cancelButton, saveButton } =
      createMathEditorElements();

    expect(card.className).toBe('math-editor-card');
    expect(content.className).toBe('math-editor-content');
    expect(textarea.className).toBe('math-editor-textarea');
    expect(actions.className).toBe('math-editor-footer');
    expect(cancelButton.getAttribute('aria-label')).toBe('Cancel');
    expect(saveButton.getAttribute('aria-label')).toBe('Apply');
    expect(cancelButton.querySelector('svg')).not.toBeNull();
    expect(saveButton.querySelector('svg')).not.toBeNull();
    expect(content.contains(textarea)).toBe(true);
  });
});
