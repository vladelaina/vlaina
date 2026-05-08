import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  blurActiveElement,
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
    const button = createCollapseToggleButton({
      collapsed: false,
      hasContent: true,
      onToggle: vi.fn(),
    });
    const icon = button.querySelector('svg');

    expect(isCollapseToggleTarget(icon)).toBe(true);
    expect(isCollapseToggleTarget(document.createElement('div'))).toBe(false);
  });

  it('stops toggle pointer interactions from bubbling to parent content', () => {
    const button = createCollapseToggleButton({
      collapsed: false,
      hasContent: true,
      onToggle: vi.fn(),
    });
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

  it('calls the toggle handler and suppresses click bubbling', () => {
    const toggleSpy = vi.fn();
    const button = createCollapseToggleButton({
      collapseType: 'list-item',
      collapsed: false,
      hasContent: true,
      onToggle: toggleSpy,
    });
    const parent = document.createElement('div');
    const parentClickSpy = vi.fn();
    parent.appendChild(button);
    parent.addEventListener('click', parentClickSpy);

    dispatchTogglePointer(button);
    const clickResult = button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('data-collapse-type')).toBe('list-item');
    expect(clickResult).toBe(false);
    expect(parentClickSpy).not.toHaveBeenCalled();
  });

  it('blurs the current active element before toggling', () => {
    const input = document.createElement('input');
    const toggleSpy = vi.fn(() => {
      expect(document.activeElement).not.toBe(input);
    });
    const button = createCollapseToggleButton({
      collapsed: false,
      hasContent: true,
      onToggle: toggleSpy,
    });
    document.body.append(input, button);
    input.focus();

    expect(document.activeElement).toBe(input);

    dispatchTogglePointer(button);

    expect(toggleSpy).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(input);
  });

  it('blurs active elements directly', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    blurActiveElement(document);

    expect(document.activeElement).not.toBe(input);
  });

  it('does not call the toggle handler when there is no collapsible content', () => {
    const toggleSpy = vi.fn();
    const button = createCollapseToggleButton({
      collapsed: false,
      hasContent: false,
      onToggle: toggleSpy,
    });

    dispatchTogglePointer(button);

    expect(toggleSpy).not.toHaveBeenCalled();
  });
});
