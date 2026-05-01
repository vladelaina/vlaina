import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileItemState } from './useFileItemState';

const mocks = vi.hoisted(() => ({
  openNote: vi.fn(),
  deleteNote: vi.fn(),
  renameNote: vi.fn(),
  toggleStarred: vi.fn(),
  isStarred: vi.fn(() => false),
  scrollCurrentNoteToTop: vi.fn(),
  notesState: {
    currentNote: { path: 'docs/alpha.md' } as { path: string } | null,
  },
}));

const notesState = {
  openNote: mocks.openNote,
  deleteNote: mocks.deleteNote,
  renameNote: mocks.renameNote,
  toggleStarred: mocks.toggleStarred,
  isStarred: mocks.isStarred,
  get currentNote() {
    return mocks.notesState.currentNote;
  },
};

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof notesState) => unknown) => selector(notesState),
}));

vi.mock('../../Editor/utils/scrollCurrentNoteToTop', () => ({
  scrollCurrentNoteToTop: mocks.scrollCurrentNoteToTop,
}));

vi.mock('./useTreeItemUiState', () => ({
  useTreeItemUiState: () => ({
    showMenu: false,
    setShowMenu: vi.fn(),
    menuPosition: { top: 0, left: 0 },
    isRenaming: false,
    setIsRenaming: vi.fn(),
    renameValue: 'alpha.md',
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

describe('useFileItemState', () => {
  beforeEach(() => {
    mocks.openNote.mockReset();
    mocks.openNote.mockResolvedValue(undefined);
    mocks.scrollCurrentNoteToTop.mockReset();
    mocks.notesState.currentNote = { path: 'docs/alpha.md' };
  });

  it('scrolls the editor to top when clicking the already active file', () => {
    const { result } = renderHook(() =>
      useFileItemState({
        id: 'docs/alpha.md',
        name: 'alpha.md',
        path: 'docs/alpha.md',
        isFolder: false,
      }),
    );

    act(() => {
      result.current.handleClick({
        stopPropagation: vi.fn(),
        ctrlKey: false,
        metaKey: false,
      } as unknown as React.MouseEvent);
    });

    expect(mocks.scrollCurrentNoteToTop).toHaveBeenCalledTimes(1);
    expect(mocks.openNote).not.toHaveBeenCalled();
  });

  it('keeps modifier-click opening behavior for the active file', () => {
    const { result } = renderHook(() =>
      useFileItemState({
        id: 'docs/alpha.md',
        name: 'alpha.md',
        path: 'docs/alpha.md',
        isFolder: false,
      }),
    );

    act(() => {
      result.current.handleClick({
        stopPropagation: vi.fn(),
        ctrlKey: true,
        metaKey: false,
      } as unknown as React.MouseEvent);
    });

    expect(mocks.scrollCurrentNoteToTop).not.toHaveBeenCalled();
    expect(mocks.openNote).toHaveBeenCalledWith('docs/alpha.md', true);
  });
});
