import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RootFolderRow } from './RootFolderRow';

const hoisted = vi.hoisted(() => ({
  notesPath: '',
  currentVault: { path: '/vault', name: 'Vault' } as { path: string; name: string } | null,
  renameCurrentVault: vi.fn(() => Promise.resolve(true)),
  setFileTreeSortMode: vi.fn(),
  toggleFolder: vi.fn(),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-icon-name={name} />,
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: any) => unknown) => selector({
    notesPath: hoisted.notesPath,
    fileTreeSortMode: 'name-asc',
    setFileTreeSortMode: hoisted.setFileTreeSortMode,
    toggleFolder: hoisted.toggleFolder,
  }),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: any) => unknown) => selector({
    currentVault: hoisted.currentVault,
    renameCurrentVault: hoisted.renameCurrentVault,
  }),
}));

vi.mock('../FileTree/hooks/fileTreePointerDragState', () => ({
  useFileTreePointerDragState: () => false,
}));

vi.mock('../FileTree/hooks/externalFileTreeDropState', () => ({
  useExternalFileTreeDropState: () => false,
}));

vi.mock('./useRootBlankContextMenu', () => ({
  useRootBlankContextMenu: () => {},
}));

vi.mock('../FileTree', () => ({
  FileTreeItem: () => null,
}));

vi.mock('../FileTree/VirtualizedFileTree', () => ({
  shouldVirtualizeFileTree: () => false,
  VirtualizedFileTree: () => null,
}));

vi.mock('../FileTree/virtualFileTree', () => ({
  countVisibleFileTreeRows: () => 0,
}));

vi.mock('./RootFolderMenu', () => ({
  RootFolderMenu: () => null,
}));

describe('RootFolderRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.notesPath = '';
    hoisted.currentVault = { path: '/vault', name: 'Vault' };
  });

  it('does not show a root loading shell when no notes target is open', () => {
    const { container } = render(
      <RootFolderRow
        rootFolder={null}
        isLoading={false}
        onCreateNote={vi.fn(() => Promise.resolve())}
        onCreateFolder={vi.fn(() => Promise.resolve(null))}
      />,
    );

    expect(container.querySelector('[data-notes-sidebar-root-loading-shell="true"]')).toBeNull();
  });

  it('shows a root loading shell while the active vault root is loading', () => {
    hoisted.notesPath = '/vault';

    const { container } = render(
      <RootFolderRow
        rootFolder={null}
        isLoading={false}
        onCreateNote={vi.fn(() => Promise.resolve())}
        onCreateFolder={vi.fn(() => Promise.resolve(null))}
      />,
    );

    expect(container.querySelector('[data-notes-sidebar-root-loading-shell="true"]')).not.toBeNull();
  });
});
