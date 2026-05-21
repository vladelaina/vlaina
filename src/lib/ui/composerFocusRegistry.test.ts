import { afterEach, describe, expect, it } from 'vitest';
import { focusComposerInput } from './composerFocusRegistry';

function createComposer({ visible }: { visible: boolean }) {
  const root = document.createElement('div');
  root.dataset.chatInput = 'true';
  root.getClientRects = () => (visible ? [{ width: 240, height: 48 }] : []) as unknown as DOMRectList;
  const textarea = document.createElement('textarea');
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
});
