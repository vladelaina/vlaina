import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorTopRightToolbar } from './EditorTopRightToolbar';
import type { NoteEditorFindController } from './find';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('./find', () => ({
  NoteEditorFindBar: () => <div data-testid="find-bar" />,
}));

function createEditorFindController(
  overrides: Partial<NoteEditorFindController> = {},
): NoteEditorFindController {
  return {
    isOpen: false,
    isReplaceOpen: false,
    query: '',
    replaceValue: '',
    activeMatchNumber: 0,
    totalMatches: 0,
    canNavigate: false,
    canReplace: false,
    inputRef: createRef<HTMLInputElement | null>(),
    replaceInputRef: createRef<HTMLInputElement | null>(),
    setQuery: vi.fn(),
    setReplaceValue: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    toggleReplace: vi.fn(),
    replaceCurrent: vi.fn(),
    replaceAll: vi.fn(),
    handleQueryKeyDown: vi.fn(),
    handleReplaceKeyDown: vi.fn(),
    ...overrides,
  };
}

describe('EditorTopRightToolbar', () => {
  it('shows the remove-star button for starred external notes outside the current vault', () => {
    const toggleStarred = vi.fn();
    const { getByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="/other/docs/alpha.md"
        notesPath="/vault"
        starred
        toggleStarred={toggleStarred}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Remove from Starred' }));

    expect(toggleStarred).toHaveBeenCalledWith('/other/docs/alpha.md');
  });

  it('hides the star button for unstarred external notes outside the current vault', () => {
    const { queryByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="/other/docs/alpha.md"
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    expect(queryByRole('button', { name: 'Add to Starred' })).toBeNull();
  });
});
