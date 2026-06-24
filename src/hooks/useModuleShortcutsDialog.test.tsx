import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useModuleShortcutsDialog } from './useModuleShortcutsDialog';

describe('useModuleShortcutsDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('toggles the dialog for Ctrl+Shift+/', () => {
    const onToggle = vi.fn();
    renderHook(() => useModuleShortcutsDialog({ onToggle }));

    const event = new KeyboardEvent('keydown', {
      key: '?',
      code: 'Slash',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not toggle the dialog for Ctrl+/', () => {
    const onToggle = vi.fn();
    renderHook(() => useModuleShortcutsDialog({ onToggle }));

    const event = new KeyboardEvent('keydown', {
      key: '/',
      code: 'Slash',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does not reopen shortcuts after an editor handled Ctrl+Shift+/', () => {
    const onToggle = vi.fn();
    renderHook(() => useModuleShortcutsDialog({ onToggle }));

    const event = new KeyboardEvent('keydown', {
      key: '?',
      code: 'Slash',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    event.preventDefault();
    window.dispatchEvent(event);

    expect(onToggle).not.toHaveBeenCalled();
  });
});
