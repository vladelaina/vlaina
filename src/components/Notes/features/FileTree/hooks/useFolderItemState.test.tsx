import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFolderItemState } from './useFolderItemState';
import { clearExternalFileTreeDropTarget, setExternalFileTreeDropTarget } from './externalFileTreeDropState';

const toggleFolder = vi.fn();
const revealFolder = vi.fn();
const deleteFolder = vi.fn();
const renameFolder = vi.fn();
const createNote = vi.fn();
const clearNewlyCreatedFolder = vi.fn();
const toggleFolderStarred = vi.fn();
const isFolderStarred = vi.fn(() => false);

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      toggleFolder,
      revealFolder,
      deleteFolder,
      renameFolder,
      createNote,
      newlyCreatedFolderPath: null,
      clearNewlyCreatedFolder,
      toggleFolderStarred,
      isFolderStarred,
    }),
}));

vi.mock('../../common/sidebarScrollIntoView', () => ({
  scrollSidebarItemIntoView: vi.fn(),
}));

vi.mock('./useTreeItemUiState', () => ({
  useTreeItemUiState: () => ({
    showMenu: false,
    setShowMenu: vi.fn(),
    menuPosition: { top: 0, left: 0 },
    isRenaming: false,
    setIsRenaming: vi.fn(),
    renameValue: 'docs',
    setRenameValue: vi.fn(),
    showDeleteDialog: false,
    setShowDeleteDialog: vi.fn(),
    handleContextMenu: vi.fn(),
    handleMenuTrigger: vi.fn(),
  }),
}));

vi.mock('./useTreeItemDragSource', () => ({
  useTreeItemDragSource: () => ({
    onPointerDown: vi.fn(),
    isDragging: false,
  }),
}));

describe('useFolderItemState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    revealFolder.mockReset();
  });

  afterEach(() => {
    act(() => {
      clearExternalFileTreeDropTarget();
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('auto-expands a collapsed folder after external drag hover settles', async () => {
    renderHook(() =>
      useFolderItemState({
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        children: [],
        expanded: false,
      }),
    );

    act(() => {
      setExternalFileTreeDropTarget('docs');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(559);
    });

    expect(revealFolder).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(revealFolder).toHaveBeenCalledWith('docs');
  });

  it('does not auto-expand after the external drag leaves early', () => {
    renderHook(() =>
      useFolderItemState({
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        children: [],
        expanded: false,
      }),
    );

    act(() => {
      setExternalFileTreeDropTarget('docs');
      vi.advanceTimersByTime(300);
      clearExternalFileTreeDropTarget();
      vi.advanceTimersByTime(400);
    });

    expect(revealFolder).not.toHaveBeenCalled();
  });
});
