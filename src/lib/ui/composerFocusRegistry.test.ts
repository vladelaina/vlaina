import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS,
  focusComposerInput,
  insertTextIntoComposer,
  MAX_COMPOSER_ROOT_SCAN_ELEMENTS,
  registerComposerFocusAdapter,
} from './composerFocusRegistry';

function createComposer({ visible }: { visible: boolean }) {
  const root = document.createElement('div');
  root.dataset.chatInput = 'true';
  root.getClientRects = () => (visible ? [{ width: 240, height: 48 }] : []) as unknown as DOMRectList;
  const textarea = document.createElement('textarea');
  textarea.getClientRects = () => (visible ? [{ width: 240, height: 24 }] : []) as unknown as DOMRectList;
  root.appendChild(textarea);
  document.body.appendChild(root);
  return textarea;
}

describe('composerFocusRegistry', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the first visible composer instead of a hidden mounted composer', () => {
    const hiddenTextarea = createComposer({ visible: false });
    const visibleTextarea = createComposer({ visible: true });

    expect(focusComposerInput()).toBe(true);

    expect(document.activeElement).toBe(visibleTextarea);
    expect(document.activeElement).not.toBe(hiddenTextarea);
  });

  it('finds the visible composer without materializing all composer roots', () => {
    createComposer({ visible: false });
    const visibleTextarea = createComposer({ visible: true });
    const querySelectorAllSpy = vi.spyOn(Document.prototype, 'querySelectorAll');
    const arrayFromSpy = vi.spyOn(Array, 'from');

    try {
      expect(focusComposerInput()).toBe(true);

      expect(document.activeElement).toBe(visibleTextarea);
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
      expect(arrayFromSpy).not.toHaveBeenCalled();
    } finally {
      querySelectorAllSpy.mockRestore();
      arrayFromSpy.mockRestore();
    }
  });

  it('stops composer root scans at the configured element budget', () => {
    for (let index = 0; index < MAX_COMPOSER_ROOT_SCAN_ELEMENTS + 1; index += 1) {
      const spacer = document.createElement('div');
      document.body.appendChild(spacer);
    }
    const textarea = createComposer({ visible: true });

    expect(focusComposerInput()).toBe(false);
    expect(document.activeElement).not.toBe(textarea);
  });

  it('falls back to the visible DOM composer when the registered adapter cannot focus', () => {
    const visibleTextarea = createComposer({ visible: true });
    const unregister = registerComposerFocusAdapter({
      focus: vi.fn(() => false),
      isFocused: vi.fn(() => false),
    });

    expect(focusComposerInput()).toBe(true);

    expect(document.activeElement).toBe(visibleTextarea);
    unregister();
  });

  it('falls back when the registered adapter reports focus without owning active focus', () => {
    const visibleTextarea = createComposer({ visible: true });
    const unregister = registerComposerFocusAdapter({
      focus: vi.fn(() => true),
      isFocused: vi.fn(() => false),
    });

    expect(focusComposerInput()).toBe(true);

    expect(document.activeElement).toBe(visibleTextarea);
    unregister();
  });

  it('rejects oversized programmatic composer inserts before reaching the adapter', () => {
    const insertText = vi.fn(() => true);
    const unregister = registerComposerFocusAdapter({
      focus: vi.fn(() => false),
      isFocused: vi.fn(() => false),
      insertText,
    });

    expect(insertTextIntoComposer('x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS + 1))).toBe(false);

    expect(insertText).not.toHaveBeenCalled();
    unregister();
  });

  it('rejects composer inserts that would exceed the bounded textarea value', () => {
    const textarea = createComposer({ visible: true });
    textarea.value = 'x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS);

    expect(insertTextIntoComposer('next')).toBe(false);

    expect(textarea.value).toBe('x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS));
  });
});
