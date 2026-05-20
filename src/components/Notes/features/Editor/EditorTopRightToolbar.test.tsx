import { createRef } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorTopRightToolbar } from './EditorTopRightToolbar';
import type { NoteEditorFindController } from './find';
import { MENU_PANEL_CLASS_NAME } from '@/components/layout/sidebar/context-menu/shared';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  currentNote: null as { path: string; content: string } | null,
  exportNote: vi.fn(),
  flushCurrentPendingEditorMarkdown: vi.fn(),
  setNotesChatPanelCollapsed: vi.fn(),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="note-menu-content" className={className}>{children}</div>
  ),
  DropdownMenuItem: ({ children, onSelect }: { children?: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="note-export-menu-content" className={className}>{children}</div>
  ),
  DropdownMenuSubTrigger: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: {
    getState: () => ({
      currentNote: mocks.currentNote,
    }),
  },
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof mocks.addToast }) => unknown) =>
    selector({ addToast: mocks.addToast }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: { setNotesChatPanelCollapsed: typeof mocks.setNotesChatPanelCollapsed }) => unknown) =>
    selector({ setNotesChatPanelCollapsed: mocks.setNotesChatPanelCollapsed }),
}));

vi.mock('@/stores/notes/pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: mocks.flushCurrentPendingEditorMarkdown,
}));

vi.mock('../Export', () => ({
  exportNote: mocks.exportNote,
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
  beforeEach(() => {
    mocks.addToast.mockReset();
    mocks.currentNote = null;
    mocks.exportNote.mockReset();
    mocks.flushCurrentPendingEditorMarkdown.mockReset();
    mocks.setNotesChatPanelCollapsed.mockReset();
  });

  it('shows the remove-star button for starred external notes outside the current vault', () => {
    const toggleStarred = vi.fn();
    const { getByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="/other/docs/alpha.md"
        currentNoteContent="# Alpha"
        currentNoteTitle="Alpha"
        notesPath="/vault"
        starred
        toggleStarred={toggleStarred}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Unfavorite' }));

    expect(toggleStarred).toHaveBeenCalledWith('/other/docs/alpha.md');
  });

  it('shows the add-star button for unstarred external notes outside the current vault', () => {
    const toggleStarred = vi.fn();
    const { getByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="/other/docs/alpha.md"
        currentNoteContent="# Alpha"
        currentNoteTitle="Alpha"
        notesPath="/vault"
        starred={false}
        toggleStarred={toggleStarred}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Add to Starred' }));

    expect(toggleStarred).toHaveBeenCalledWith('/other/docs/alpha.md');
  });

  it('exports the current toolbar note path when the store note is stale', async () => {
    mocks.currentNote = {
      path: 'old.md',
      content: '# Old',
    };
    mocks.exportNote.mockResolvedValue({ canceled: false });

    const { getByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteContent="# Current"
        currentNoteTitle="Current"
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'HTML' }));

    await waitFor(() => {
      expect(mocks.exportNote).toHaveBeenCalledWith({
        format: 'html',
        markdown: '# Current',
        notePath: 'docs/current.md',
        notesPath: '/vault',
        title: 'Current',
      });
    });
    expect(mocks.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
  });

  it('opens the right Spark panel from the first note menu action', () => {
    const { getByRole, getByTestId } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteContent="# Current"
        currentNoteTitle="Current"
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Right Spark' }));

    const firstMenuAction = getByTestId('note-menu-content').querySelector('button');
    expect(firstMenuAction).toHaveTextContent('Right Spark');
    expect(mocks.setNotesChatPanelCollapsed).toHaveBeenCalledWith(false);
  });

  it('uses the sidebar context menu surface for note info and export menus', () => {
    const { getByTestId } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteContent="# Current"
        currentNoteTitle="Current"
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    expect(getByTestId('note-menu-content').className).toContain(MENU_PANEL_CLASS_NAME);
    expect(getByTestId('note-export-menu-content').className).toContain(MENU_PANEL_CLASS_NAME);
    expect(getByTestId('note-menu-content').className).toContain('vlaina-sidebar-menu-surface');
    expect(getByTestId('note-export-menu-content').className).toContain('vlaina-sidebar-menu-surface');
  });

  it('uses the sidebar selected surface for export previews', () => {
    const { getByText } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteContent="# Current"
        currentNoteTitle="Current"
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
        textStats={{ lineCount: 1, wordCount: 2, characterCount: 3 }}
      />,
    );

    expect(getByText('Export').className).toContain('data-[state=open]:bg-[var(--notes-sidebar-row-active)]');
    expect(getByText('Export').className).toContain('data-[state=open]:text-[var(--sidebar-row-selected-text)]');
  });
});
