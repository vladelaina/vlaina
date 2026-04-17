import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COLLAPSE_TOGGLE_EVENT,
  createCollapseToggleButton,
  isCollapseToggleTarget,
} from './collapseUtils';

function dispatchTogglePointer(button: HTMLElement) {
  if (typeof PointerEvent !== 'undefined') {
    return button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  }

  return button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

describe('collapseUtils', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects collapse toggle targets from nested button content', () => {
    const button = createCollapseToggleButton('list-item', 5, false, true);
    const icon = button.querySelector('svg');

    expect(isCollapseToggleTarget(icon)).toBe(true);
    expect(isCollapseToggleTarget(document.createElement('div'))).toBe(false);
  });

  it('stops toggle pointer interactions from bubbling to parent content', () => {
    const button = createCollapseToggleButton('list-item', 7, false, true);
    const parent = document.createElement('div');
    const parentPointerSpy = vi.fn();
    parent.appendChild(button);

    if (typeof PointerEvent !== 'undefined') {
      parent.addEventListener('pointerdown', parentPointerSpy);
    } else {
      parent.addEventListener('mousedown', parentPointerSpy);
    }

    const dispatchResult = dispatchTogglePointer(button);

    expect(dispatchResult).toBe(false);
    expect(parentPointerSpy).not.toHaveBeenCalled();
  });

  it('dispatches the collapse toggle event and suppresses click bubbling', () => {
    const button = createCollapseToggleButton('list-item', 11, false, true);
    const parent = document.createElement('div');
    const parentClickSpy = vi.fn();
    const toggleSpy = vi.fn();
    parent.appendChild(button);
    parent.addEventListener('click', parentClickSpy);
    document.addEventListener(COLLAPSE_TOGGLE_EVENT, toggleSpy);

    try {
      dispatchTogglePointer(button);
      const clickResult = button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(toggleSpy).toHaveBeenCalledTimes(1);
      expect(toggleSpy.mock.calls[0][0]).toMatchObject({
        detail: { type: 'list-item', pos: 11 },
      });
      expect(clickResult).toBe(false);
      expect(parentClickSpy).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener(COLLAPSE_TOGGLE_EVENT, toggleSpy);
    }
  });
});
