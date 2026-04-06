import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_FIND_OPEN_EVENT } from '@/components/Notes/features/Editor/find/editorFindEvents';
import { SIDEBAR_OPEN_SEARCH_EVENT } from '@/components/layout/sidebar/sidebarEvents';
import { useUIStore } from '@/stores/uiSlice';
import { useShortcuts } from './useShortcuts';

describe('useShortcuts', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({
      appViewMode: 'notes',
      notesSidebarView: 'workspace',
      drawerOpen: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches in-note find for Ctrl+F in notes mode', () => {
    const editorFindListener = vi.fn();
    const sidebarListener = vi.fn();
    window.addEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
    window.addEventListener(SIDEBAR_OPEN_SEARCH_EVENT, sidebarListener);

    try {
      renderHook(() => useShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        code: 'KeyF',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(editorFindListener).toHaveBeenCalledTimes(1);
      expect(sidebarListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
      window.removeEventListener(SIDEBAR_OPEN_SEARCH_EVENT, sidebarListener);
    }
  });

  it('dispatches sidebar search for Ctrl+Shift+F', () => {
    const editorFindListener = vi.fn();
    const sidebarListener = vi.fn();
    window.addEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
    window.addEventListener(SIDEBAR_OPEN_SEARCH_EVENT, sidebarListener);

    try {
      renderHook(() => useShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'F',
        code: 'KeyF',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(sidebarListener).toHaveBeenCalledTimes(1);
      expect(editorFindListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
      window.removeEventListener(SIDEBAR_OPEN_SEARCH_EVENT, sidebarListener);
    }
  });

  it('does not dispatch in-note find outside notes mode', () => {
    useUIStore.setState({ appViewMode: 'chat' });
    const editorFindListener = vi.fn();
    window.addEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);

    try {
      renderHook(() => useShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        code: 'KeyF',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(editorFindListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
    }
  });
});
