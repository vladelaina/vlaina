import type { ReactNode } from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RootFolderMenu } from './RootFolderMenu';

const hoisted = vi.hoisted(() => ({
  closeVault: vi.fn(() => Promise.resolve(true)),
  handleCopyPath: vi.fn(() => Promise.resolve()),
  handleOpenLocation: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon-name={name} />,
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: any) => unknown) => selector({
    closeVault: hoisted.closeVault,
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
              <span>
                {entry.icon}
                {entry.label}
              </span>
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
            {entry.icon}
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

function renderMenu({
  onClose = vi.fn(),
  vaultPath = '/vault',
}: {
  onClose?: () => void;
  vaultPath?: string;
} = {}) {
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
        vaultPath={vaultPath}
      />,
    ),
  };
}

describe('RootFolderMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders close folder directly below More', () => {
    const { getByText, getByTestId } = renderMenu();

    const moreLabel = getByText('More');
    const closeAction = getByText('Close Folder');

    expect(closeAction).toHaveAttribute('data-menu-depth', '0');
    expect(getByTestId('submenu-more')).toHaveAttribute('data-menu-depth', '0');
    expect(getByTestId('submenu-more')).not.toContainElement(closeAction);
    expect(moreLabel.compareDocumentPosition(closeAction) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('closes the current folder', async () => {
    const { getByText, onClose } = renderMenu();

    fireEvent.click(getByText('Close Folder'));

    await waitFor(() => {
      expect(hoisted.closeVault).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables closing when no folder is open', () => {
    const { getByText } = renderMenu({ vaultPath: '' });

    expect(getByText('Close Folder')).toBeDisabled();
  });

  it('uses the same open folder location icon as file tree folder menus', () => {
    const { getByText } = renderMenu();

    const openLocationAction = getByText('Open Folder Location').closest('button');

    expect(openLocationAction?.querySelector('[data-icon-name="file.folderOpenArrow"]'))
      .not.toBeNull();
  });
});
