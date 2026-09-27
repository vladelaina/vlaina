import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampContextMenuPosition,
  getContextMenuShortcutLabel,
  IconButton,
} from './noteEditorContextMenuPrimitives';

describe('note editor context menu positioning', () => {
  it('keeps the menu inside each viewport edge', () => {
    Object.defineProperties(window, {
      innerHeight: { configurable: true, value: 600 },
      innerWidth: { configurable: true, value: 800 },
    });

    expect(clampContextMenuPosition({ left: -40, top: -20 }, 240, 300)).toEqual({
      left: 8,
      top: 8,
    });
    expect(clampContextMenuPosition({ left: 760, top: 580 }, 240, 300)).toEqual({
      left: 552,
      top: 292,
    });
  });
});

describe('note editor context menu icon tooltips', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats shortcuts for desktop and macOS platforms', () => {
    expect(getContextMenuShortcutLabel('Ctrl+Shift+K', 'Linux x86_64')).toBe('Ctrl+Shift+K');
    expect(getContextMenuShortcutLabel('Ctrl+Shift+K', 'MacIntel')).toBe('⌘⇧K');
  });

  it('keeps a disabled button hoverable through its trigger wrapper', () => {
    vi.useFakeTimers();
    render(
      <IconButton
        icon="common.cut"
        label="Cut"
        shortcut="Ctrl+X"
        disabled
        onClick={vi.fn()}
      />,
    );

    const button = screen.getByRole('menuitem', { name: 'Cut' });
    expect(button).toBeDisabled();
    const trigger = button.parentElement;
    expect(trigger).toHaveClass('editor-context-menu-icon-trigger');

    fireEvent.pointerMove(trigger!, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Cut');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ctrl+X');
  });

  it('opens the same tooltip when an enabled button receives keyboard focus', () => {
    vi.useFakeTimers();
    render(
      <IconButton
        icon="editor.bold"
        label="Bold"
        shortcut="Ctrl+B"
        onClick={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByRole('menuitem', { name: 'Bold' }));
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Bold');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Ctrl+B');
  });
});
