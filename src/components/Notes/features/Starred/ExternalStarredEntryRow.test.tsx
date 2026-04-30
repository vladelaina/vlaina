import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExternalStarredEntryRow } from './ExternalStarredEntryRow';

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => undefined,
  useDisplayName: (path: string | undefined) =>
    path === '/vault-b/docs/alpha.md' ? 'Live External' : undefined,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('../IconPicker/NoteIcon', () => ({
  NoteIcon: () => <span>note-icon</span>,
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
  NotesSidebarContextMenuContent: () => null,
}));

vi.mock('../common/SidebarStarBadge', () => ({
  SidebarStarBadge: () => <button type="button">star</button>,
}));

describe('ExternalStarredEntryRow', () => {
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
});
