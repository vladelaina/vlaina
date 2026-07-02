import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalStarredEntryRow } from './ExternalStarredEntryRow';

const mocked = vi.hoisted(() => ({
  starredIcon: undefined as string | undefined,
  contextMenuEntries: [] as Array<{ key?: string; kind?: string; label?: string; children?: Array<{ key?: string; label?: string }> }>,
  handleCopyPath: vi.fn(),
  handleOpenInNewWindow: vi.fn(),
  handleOpenLocation: vi.fn(),
  renameNote: vi.fn(),
  renameAbsoluteNote: vi.fn(),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => undefined,
  useDisplayName: (path: string | undefined) =>
    path === '/notes-root-b/docs/alpha.md' ? 'Live External' : undefined,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: {
    renameNote: typeof mocked.renameNote;
    renameAbsoluteNote: typeof mocked.renameAbsoluteNote;
  }) => unknown) => selector({
    renameNote: mocked.renameNote,
    renameAbsoluteNote: mocked.renameAbsoluteNote,
  }),
}));

vi.mock('../IconPicker/NoteIcon', () => ({
  NoteIcon: ({ icon, notesRootPath }: { icon: string; notesRootPath?: string }) => (
    <span data-notes-root-path={notesRootPath}>{icon}</span>
  ),
}));

vi.mock('../Sidebar/NotesSidebarRow', () => ({
  NotesSidebarRow: ({
    leading,
    main,
    actions,
    onClick,
    onDoubleClick,
  }: {
    leading?: React.ReactNode;
    main?: React.ReactNode;
    actions?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  }) => (
    <div onClick={onClick} onDoubleClick={onDoubleClick}>
      {leading}
      {main}
      {actions}
    </div>
  ),
}));

vi.mock('../Sidebar/NotesSidebarContextMenu', () => ({
  NotesSidebarContextMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../Sidebar/context-menu/NotesSidebarContextMenuContent', () => ({
  NotesSidebarContextMenuContent: ({ entries }: { entries: typeof mocked.contextMenuEntries }) => {
    mocked.contextMenuEntries = entries;
    return null;
  },
}));

vi.mock('./useStarredEntryIcon', () => ({
  useStarredEntryIcon: () => mocked.starredIcon,
}));

vi.mock('../FileTree/hooks/useTreeItemPathActions', () => ({
  useTreeItemPathActions: () => ({
    handleCopyPath: mocked.handleCopyPath,
    handleOpenInNewWindow: mocked.handleOpenInNewWindow,
    handleOpenLocation: mocked.handleOpenLocation,
  }),
}));

describe('ExternalStarredEntryRow', () => {
  beforeEach(() => {
    mocked.starredIcon = undefined;
    mocked.contextMenuEntries = [];
    mocked.handleCopyPath.mockReset();
    mocked.handleOpenInNewWindow.mockReset();
    mocked.handleOpenLocation.mockReset();
    mocked.renameNote.mockReset();
    mocked.renameNote.mockResolvedValue(undefined);
    mocked.renameAbsoluteNote.mockReset();
    mocked.renameAbsoluteNote.mockResolvedValue(undefined);
  });

  it('subscribes external starred notes using their absolute path', () => {
    const { getByText } = render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-1',
          kind: 'note',
          notesRootPath: '/notes-root-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentNotesRootEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(getByText('Live External')).toBeTruthy();
  });

  it('uses the starred file icon when no live metadata is loaded', () => {
    mocked.starredIcon = '💡';

    const { getByText } = render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-1',
          kind: 'note',
          notesRootPath: '/notes-root-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentNotesRootEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(getByText('💡').dataset.notesRootPath).toBe('/notes-root-b');
  });

  it('offers the same More submenu for starred notes', async () => {
    const { getByLabelText } = render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-1',
          kind: 'note',
          notesRootPath: '/notes-root-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentNotesRootEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.click(getByLabelText('Open starred item menu'));

    await waitFor(() => {
      expect(mocked.contextMenuEntries.some((entry) => entry.key === 'more')).toBe(true);
    });
    const moreEntry = mocked.contextMenuEntries.find((entry) => entry.key === 'more');

    expect(moreEntry).toMatchObject({
      kind: 'submenu',
      label: 'More',
    });
    expect(moreEntry?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'copy-path', label: 'Copy Path' }),
      expect.objectContaining({ key: 'open-location', label: 'Open File Location' }),
      expect.objectContaining({ key: 'open-new-window', label: 'Open in New Window' }),
    ]));
    expect(moreEntry?.children?.map((entry) => entry.key)).toEqual([
      'copy-path',
      'open-new-window',
      'open-location',
    ]);
  });

  it('uses the folder location label for starred folders', async () => {
    const { getByLabelText } = render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-folder',
          kind: 'folder',
          notesRootPath: '/notes-root-b',
          relativePath: 'docs',
          addedAt: 1,
        }}
        isCurrentNotesRootEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.click(getByLabelText('Open starred item menu'));

    await waitFor(() => {
      expect(mocked.contextMenuEntries.some((entry) => entry.key === 'more')).toBe(true);
    });
    const moreEntry = mocked.contextMenuEntries.find((entry) => entry.key === 'more');

    expect(moreEntry?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open-location', label: 'Open Folder Location' }),
    ]));
  });

  it('opens the menu action without opening the starred note row', () => {
    const onOpen = vi.fn();
    const { getByLabelText } = render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-1',
          kind: 'note',
          notesRootPath: '/notes-root-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentNotesRootEntry={false}
        isActive={false}
        onOpen={onOpen}
        onRemove={vi.fn()}
      />,
    );

    fireEvent.click(getByLabelText('Open starred item menu'));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('double-clicks to rename a current-notesRoot starred note without opening it first', async () => {
    vi.useFakeTimers();
    try {
      const onOpen = vi.fn();
      const { getByText, getByDisplayValue } = render(
        <ExternalStarredEntryRow
          entry={{
            id: 'starred-1',
            kind: 'note',
            notesRootPath: '/notes-root-b',
            relativePath: 'docs/alpha.md',
            addedAt: 1,
          }}
          isCurrentNotesRootEntry={true}
          isActive={false}
          onOpen={onOpen}
          onRemove={vi.fn()}
        />,
      );

      fireEvent.doubleClick(getByText('alpha'));
      act(() => {
        vi.advanceTimersByTime(180);
      });

      expect(onOpen).not.toHaveBeenCalled();
      const input = getByDisplayValue('alpha');
      fireEvent.change(input, { target: { value: 'Renamed' } });
      await act(async () => {
        fireEvent.keyDown(input, { key: 'Enter' });
      });

      expect(mocked.renameNote).toHaveBeenCalledWith('docs/alpha.md', 'Renamed');
    } finally {
      vi.useRealTimers();
    }
  });
});
