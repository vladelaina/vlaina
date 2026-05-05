import type { ReactNode } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RootFolderMenu } from './RootFolderMenu';

const hoisted = vi.hoisted(() => ({
  closeTab: vi.fn(() => Promise.resolve()),
  currentNote: { path: 'alpha.md', content: '' } as { path: string; content: string } | null,
  openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
  handleCopyPath: vi.fn(() => Promise.resolve()),
  handleOpenLocation: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    closeTab: hoisted.closeTab,
    currentNote: hoisted.currentNote,
    openTabs: hoisted.openTabs,
  }),
}));

vi.mock('../FileTree/hooks/useTreeItemPathActions', () => ({
  useTreeItemPathActions: () => ({
    handleCopyPath: hoisted.handleCopyPath,
    handleOpenLocation: hoisted.handleOpenLocation,
  }),
}));

vi.mock('./NotesSidebarContextMenu', () => ({
  NotesSidebarContextMenu: ({
    children,
    isOpen,
  }: {
    children?: ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock('./context-menu/NotesSidebarContextMenuContent', () => {
  const renderEntries = (entries: any[], depth = 0): ReactNode => (
    <div data-menu-depth={depth}>
      {entries.map((entry) => {
        if (entry.kind === 'divider') {
          return <hr key={entry.key} />;
        }

        if (entry.kind === 'submenu') {
          return (
            <div key={entry.key} data-testid={`submenu-${entry.key}`} data-menu-depth={depth}>
              <span>{entry.label}</span>
              {renderEntries(entry.children, depth + 1)}
            </div>
          );
        }

        return (
          <button
            key={entry.key}
            type="button"
            disabled={entry.disabled}
            onClick={entry.onClick}
            data-menu-depth={depth}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );

  return {
    NotesSidebarContextMenuContent: ({ entries }: { entries: any[] }) => renderEntries(entries),
  };
});

function renderMenu(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <RootFolderMenu
        isOpen
        onClose={onClose}
        position={{ top: 0, left: 0 }}
        expanded
        setExpanded={vi.fn()}
        onCreateNote={vi.fn(() => Promise.resolve())}
        onCreateFolder={vi.fn(() => Promise.resolve(null))}
        onStartRename={vi.fn()}
        fileTreeSortMode="name-asc"
        onSelectSortMode={vi.fn()}
        vaultPath="/vault"
      />,
    ),
  };
}

describe('RootFolderMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.currentNote = { path: 'alpha.md', content: '' };
    hoisted.openTabs = [{ path: 'alpha.md', name: 'alpha', isDirty: false }];
  });

  it('renders close current note directly below More', () => {
    const { getByText, getByTestId } = renderMenu();

    const moreLabel = getByText('More');
    const closeAction = getByText('Close Current Note');

    expect(closeAction).toHaveAttribute('data-menu-depth', '0');
    expect(getByTestId('submenu-more')).toHaveAttribute('data-menu-depth', '0');
    expect(getByTestId('submenu-more')).not.toContainElement(closeAction);
    expect(moreLabel.compareDocumentPosition(closeAction) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('closes the current open note', async () => {
    const { getByText, onClose } = renderMenu();

    fireEvent.click(getByText('Close Current Note'));

    await waitFor(() => {
      expect(hoisted.closeTab).toHaveBeenCalledWith('alpha.md');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the current note even when it is not in the open tabs list', async () => {
    hoisted.currentNote = { path: 'loose.md', content: '' };
    hoisted.openTabs = [];
    const { getByText, onClose } = renderMenu();

    fireEvent.click(getByText('Close Current Note'));

    await waitFor(() => {
      expect(hoisted.closeTab).toHaveBeenCalledWith('loose.md');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables closing when no current note is open', () => {
    hoisted.currentNote = null;
    const { getByText } = renderMenu();

    expect(getByText('Close Current Note')).toBeDisabled();
  });
});
