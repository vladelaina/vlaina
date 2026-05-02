import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalStarredEntryRow } from './ExternalStarredEntryRow';

const mocked = vi.hoisted(() => ({
  starredIcon: undefined as string | undefined,
  contextMenuEntries: [] as Array<{ key?: string; kind?: string; label?: string; children?: Array<{ key?: string; label?: string }> }>,
  handleCopyPath: vi.fn(),
  handleOpenLocation: vi.fn(),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => undefined,
  useDisplayName: (path: string | undefined) =>
    path === '/vault-b/docs/alpha.md' ? 'Live External' : undefined,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('../IconPicker/NoteIcon', () => ({
  NoteIcon: ({ icon, vaultPath }: { icon: string; vaultPath?: string }) => (
    <span data-vault-path={vaultPath}>{icon}</span>
  ),
}));

vi.mock('../Sidebar/NotesSidebarRow', () => ({
  NotesSidebarRow: ({ leading, main }: { leading?: React.ReactNode; main?: React.ReactNode }) => (
    <div>
      {leading}
      {main}
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

vi.mock('../common/SidebarStarBadge', () => ({
  SidebarStarBadge: () => <button type="button">star</button>,
}));

vi.mock('./useStarredEntryIcon', () => ({
  useStarredEntryIcon: () => mocked.starredIcon,
}));

vi.mock('../FileTree/hooks/useTreeItemPathActions', () => ({
  useTreeItemPathActions: () => ({
    handleCopyPath: mocked.handleCopyPath,
    handleOpenLocation: mocked.handleOpenLocation,
  }),
}));

describe('ExternalStarredEntryRow', () => {
  beforeEach(() => {
    mocked.starredIcon = undefined;
    mocked.contextMenuEntries = [];
    mocked.handleCopyPath.mockReset();
    mocked.handleOpenLocation.mockReset();
  });

  it('subscribes external starred notes using their absolute path', () => {
    const { getByText } = render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-1',
          kind: 'note',
          vaultPath: '/vault-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentVaultEntry={false}
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
          vaultPath: '/vault-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentVaultEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(getByText('💡').dataset.vaultPath).toBe('/vault-b');
  });

  it('offers the same More submenu for starred notes', () => {
    render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-1',
          kind: 'note',
          vaultPath: '/vault-b',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        }}
        isCurrentVaultEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const moreEntry = mocked.contextMenuEntries.find((entry) => entry.key === 'more');

    expect(moreEntry).toMatchObject({
      kind: 'submenu',
      label: 'More',
    });
    expect(moreEntry?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'copy-path', label: 'Copy Path' }),
      expect.objectContaining({ key: 'open-location', label: 'Open File Location' }),
    ]));
  });

  it('uses the folder location label for starred folders', () => {
    render(
      <ExternalStarredEntryRow
        entry={{
          id: 'starred-folder',
          kind: 'folder',
          vaultPath: '/vault-b',
          relativePath: 'docs',
          addedAt: 1,
        }}
        isCurrentVaultEntry={false}
        isActive={false}
        onOpen={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const moreEntry = mocked.contextMenuEntries.find((entry) => entry.key === 'more');

    expect(moreEntry?.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open-location', label: 'Open Folder Location' }),
    ]));
  });
});
