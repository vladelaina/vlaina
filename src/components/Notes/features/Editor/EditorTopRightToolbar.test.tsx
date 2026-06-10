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
  notesChatPanelCollapsed: true,
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
  useNotesStore: Object.assign(
    (selector: (state: { currentNote: typeof mocks.currentNote }) => unknown) =>
      selector({ currentNote: mocks.currentNote }),
    {
      getState: () => ({
        currentNote: mocks.currentNote,
        noteContentsCache: new Map(
          mocks.currentNote ? [[mocks.currentNote.path, { content: mocks.currentNote.content }]] : [],
        ),
        isDirty: false,
        openTabs: mocks.currentNote ? [{ path: mocks.currentNote.path, name: 'Current', isDirty: false }] : [],
      }),
    },
  ),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof mocks.addToast }) => unknown) =>
    selector({ addToast: mocks.addToast }),
}));

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: {
    notesChatPanelCollapsed: boolean;
    setNotesChatPanelCollapsed: typeof mocks.setNotesChatPanelCollapsed;
  }) => unknown) =>
    selector({
      notesChatPanelCollapsed: mocks.notesChatPanelCollapsed,
      setNotesChatPanelCollapsed: mocks.setNotesChatPanelCollapsed,
    }),
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
    mocks.notesChatPanelCollapsed = true;
    mocks.setNotesChatPanelCollapsed.mockReset();
  });

  it('shows the remove-star button for starred external notes outside the current vault', () => {
    const toggleStarred = vi.fn();
    const { getByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="/other/docs/alpha.md"
        currentNoteTitle="Alpha"
        getCurrentNoteContent={() => '# Alpha'}
        notesPath="/vault"
        starred
        toggleStarred={toggleStarred}
        currentNoteMetadata={undefined}
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
        currentNoteTitle="Alpha"
        getCurrentNoteContent={() => '# Alpha'}
        notesPath="/vault"
        starred={false}
        toggleStarred={toggleStarred}
        currentNoteMetadata={undefined}
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
        currentNoteTitle="Current"
        getCurrentNoteContent={() => '# Current'}
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
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

  it('does not read full note content while rendering the toolbar', () => {
    const getCurrentNoteContent = vi.fn(() => '# Current');

    render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteTitle="Current"
        getCurrentNoteContent={getCurrentNoteContent}
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
      />,
    );

    expect(getCurrentNoteContent).not.toHaveBeenCalled();
  });

  it('opens the right Chat panel from the toolbar action and removes it from the note menu', () => {
    const { container, getByRole, getByTestId } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteTitle="Current"
        getCurrentNoteContent={() => '# Current'}
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Right Chat' }));

    const toolbarIcons = Array.from(container.querySelectorAll('[data-icon]')).map((icon) => icon.getAttribute('data-icon'));
    expect(toolbarIcons.slice(0, 3)).toEqual(['misc.star', 'common.shootingStar', 'common.more']);
    expect(getByTestId('note-menu-content')).not.toHaveTextContent('Right Chat');
    expect(mocks.setNotesChatPanelCollapsed).toHaveBeenCalledWith(false);
  });

  it('hides the right Chat toolbar action while the panel is open', () => {
    mocks.notesChatPanelCollapsed = false;

    const { container, queryByRole } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteTitle="Current"
        getCurrentNoteContent={() => '# Current'}
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
      />,
    );

    const toolbarIcons = Array.from(container.querySelectorAll('[data-icon]')).map((icon) => icon.getAttribute('data-icon'));
    expect(queryByRole('button', { name: 'Right Chat' })).not.toBeInTheDocument();
    expect(toolbarIcons.slice(0, 2)).toEqual(['misc.star', 'common.more']);
  });

  it('uses the sidebar context menu surface for note info and export menus', () => {
    const { getByTestId } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteTitle="Current"
        getCurrentNoteContent={() => '# Current'}
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
      />,
    );

    expect(getByTestId('note-menu-content').className).toContain(MENU_PANEL_CLASS_NAME);
    expect(getByTestId('note-export-menu-content').className).toContain(MENU_PANEL_CLASS_NAME);
    expect(getByTestId('note-menu-content').className).toContain('sidebar-menu-surface');
    expect(getByTestId('note-export-menu-content').className).toContain('sidebar-menu-surface');
  });

  it('uses the sidebar selected surface for export previews', () => {
    const { getByText } = render(
      <EditorTopRightToolbar
        editorFind={createEditorFindController()}
        currentNotePath="docs/current.md"
        currentNoteTitle="Current"
        getCurrentNoteContent={() => '# Current'}
        notesPath="/vault"
        starred={false}
        toggleStarred={vi.fn()}
        currentNoteMetadata={undefined}
      />,
    );

    expect(getByText('Export').className).toContain('data-[state=open]:bg-[var(--vlaina-sidebar-notes-row-active)]');
    expect(getByText('Export').className).toContain('data-[state=open]:text-[var(--vlaina-sidebar-row-selected-text)]');
  });
});
