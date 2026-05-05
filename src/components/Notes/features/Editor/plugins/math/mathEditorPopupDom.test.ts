import { describe, expect, it, vi } from 'vitest';
import {
  createMathEditorElements,
  mountMathEditorCard,
} from './mathEditorPopupDom';

describe('mathEditorPopupDom', () => {
  it('creates a simplified math editor card with a textarea and actions', () => {
    const { card, content, textarea, actions, cancelButton, saveButton } =
      createMathEditorElements();

    expect(card.classList.contains('text-editor-card')).toBe(true);
    expect(card.classList.contains('math-editor-card')).toBe(true);
    expect(card.querySelector('.math-editor-header')).toBeNull();
    expect(card.querySelector('.math-editor-rail')).toBeNull();
    expect(content.classList.contains('text-editor-content')).toBe(true);
    expect(content.classList.contains('math-editor-content')).toBe(true);
    expect(textarea.classList.contains('text-editor-textarea')).toBe(true);
    expect(textarea.classList.contains('math-editor-textarea')).toBe(true);
    expect(actions.classList.contains('text-editor-footer')).toBe(true);
    expect(actions.classList.contains('math-editor-footer')).toBe(true);
    expect(cancelButton.getAttribute('aria-label')).toBe('Cancel');
    expect(saveButton.getAttribute('aria-label')).toBe('Save');
    expect(cancelButton.textContent).toBe('Cancel');
    expect(saveButton.textContent).toBe('Save');
    expect(content.contains(textarea)).toBe(true);
  });

  it('allows callers to customize the shared editor placeholder', () => {
    const { textarea } = createMathEditorElements('Enter Mermaid diagram...');

    expect(textarea.placeholder).toBe('Enter Mermaid diagram...');
  });

  it('lets Enter create textarea line breaks and uses Ctrl or Command Enter to save', () => {
    const container = document.createElement('div');
    const onInput = vi.fn();
    const onCancel = vi.fn();
    const onSave = vi.fn();
    const { textarea } = mountMathEditorCard({
      container,
      latex: 'x',
      displayMode: true,
      onInput,
      onCancel,
      onSave,
    });

    const plainEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(plainEnter);

    expect(plainEnter.defaultPrevented).toBe(false);
    expect(onSave).not.toHaveBeenCalled();

    const ctrlEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(ctrlEnter);

    expect(ctrlEnter.defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(1);

    const metaEnter = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(metaEnter);

    expect(metaEnter.defaultPrevented).toBe(true);
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('keeps Escape as a cancel shortcut', () => {
    const container = document.createElement('div');
    const onCancel = vi.fn();
    const onSave = vi.fn();
    const { textarea } = mountMathEditorCard({
      container,
      latex: 'x',
      displayMode: false,
      onInput: vi.fn(),
      onCancel,
      onSave,
    });

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(escape);

    expect(escape.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
