import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EDITOR_FIND_OPEN_EVENT } from '@/components/Notes/features/Editor/find/editorFindEvents';
import { DELETE_CURRENT_NOTE_EVENT } from '@/components/Notes/noteDeleteEvents';
import { SIDEBAR_OPEN_SEARCH_EVENT } from '@/components/layout/sidebar/sidebarEvents';
import { useNotesStore } from '@/stores/useNotesStore';
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
    useNotesStore.setState({
      pendingDeletedItems: [],
      restoreLastDeletedItem: vi.fn().mockResolvedValue(null),
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


  it('does not dispatch find shortcuts from inside a dialog', () => {
    const editorFindListener = vi.fn();
    const sidebarListener = vi.fn();
    window.addEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
    window.addEventListener(SIDEBAR_OPEN_SEARCH_EVENT, sidebarListener);

    try {
      renderHook(() => useShortcuts());

      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      const button = document.createElement('button');
      dialog.appendChild(button);
      document.body.appendChild(dialog);

      const findEvent = new KeyboardEvent('keydown', {
        key: 'f',
        code: 'KeyF',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(findEvent);

      const sidebarEvent = new KeyboardEvent('keydown', {
        key: 'F',
        code: 'KeyF',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      button.dispatchEvent(sidebarEvent);

      expect(findEvent.defaultPrevented).toBe(false);
      expect(sidebarEvent.defaultPrevented).toBe(false);
      expect(editorFindListener).not.toHaveBeenCalled();
      expect(sidebarListener).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(EDITOR_FIND_OPEN_EVENT, editorFindListener);
      window.removeEventListener(SIDEBAR_OPEN_SEARCH_EVENT, sidebarListener);
    }
  });


  it('dispatches delete current note for Ctrl+Shift+Backspace in notes mode', () => {
    const deleteListener = vi.fn();
    window.addEventListener(DELETE_CURRENT_NOTE_EVENT, deleteListener);

    try {
      renderHook(() => useShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'Backspace',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(deleteListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(DELETE_CURRENT_NOTE_EVENT, deleteListener);
    }
  });

  it('dispatches open markdown file for Ctrl+O in notes mode', () => {
    const openMarkdownListener = vi.fn();
    window.addEventListener('vlaina-open-markdown-file', openMarkdownListener);

    try {
      renderHook(() => useShortcuts());

      const event = new KeyboardEvent('keydown', {
        key: 'o',
        code: 'KeyO',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(openMarkdownListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('vlaina-open-markdown-file', openMarkdownListener);
    }
  });

  it('restores the last deleted item for Ctrl+Z outside editable content', async () => {
    const restoreLastDeletedItem = vi.fn().mockResolvedValue('alpha.md');
    useNotesStore.setState({
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
      restoreLastDeletedItem,
    });

    renderHook(() => useShortcuts());

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);
    await Promise.resolve();

    expect(event.defaultPrevented).toBe(true);
    expect(restoreLastDeletedItem).toHaveBeenCalledTimes(1);
  });

  it('does not steal Ctrl+Z from editor content', async () => {
    const restoreLastDeletedItem = vi.fn().mockResolvedValue('alpha.md');
    useNotesStore.setState({
      pendingDeletedItems: [{
        id: 'delete-1',
        kind: 'file',
        originalPath: 'alpha.md',
        originalFullPath: '/vault/alpha.md',
        trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/alpha.md',
        deletedAt: 1,
        previousCurrentNote: null,
        previousIsDirty: false,
        deletedStarredEntries: [],
        deletedMetadata: null,
      }],
      restoreLastDeletedItem,
    });

    try {
      renderHook(() => useShortcuts());

      const editor = document.createElement('div');
      editor.className = 'ProseMirror';
      editor.setAttribute('contenteditable', 'true');
      document.body.appendChild(editor);

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        code: 'KeyZ',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });

      editor.dispatchEvent(event);
      await Promise.resolve();

      expect(event.defaultPrevented).toBe(false);
      expect(restoreLastDeletedItem).not.toHaveBeenCalled();
    } finally {
      document.querySelector('.ProseMirror')?.remove();
    }
  });

  it('does not prevent Ctrl+Z when there is no deleted item to restore', async () => {
    const restoreLastDeletedItem = vi.fn().mockResolvedValue(null);
    useNotesStore.setState({
      pendingDeletedItems: [],
      restoreLastDeletedItem,
    });

    renderHook(() => useShortcuts());

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    window.dispatchEvent(event);
    await Promise.resolve();

    expect(event.defaultPrevented).toBe(false);
    expect(restoreLastDeletedItem).not.toHaveBeenCalled();
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
