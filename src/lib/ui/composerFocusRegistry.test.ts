import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusComposerInput, registerComposerFocusAdapter } from './composerFocusRegistry';

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
});
