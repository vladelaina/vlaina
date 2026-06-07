import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesTagsSection } from './NotesTagsSection';

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
  stat: vi.fn(async (): Promise<{ isFile?: boolean; modifiedAt?: number; size?: number } | null> => null),
  noteIcon: vi.fn(({ icon }: { icon: string }) => <span data-testid="note-icon">{icon}</span>),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readFile: mocked.readFile,
    stat: mocked.stat,
  }),
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: async (...segments: string[]) => segments.join('/').replace(/\/+/g, '/'),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: { notesPath: string }) => unknown) => selector({ notesPath: '/vault' }),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => undefined,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid="fallback-icon">{name}</span>,
}));

vi.mock('../IconPicker/NoteIcon', () => ({
  NoteIcon: mocked.noteIcon,
}));

vi.mock('../common/collapseTrianglePrimitive', () => ({
  CollapseTriangleAffordance: () => null,
}));

vi.mock('./NotesSidebarRow', () => ({
  NotesSidebarRow: ({
    leading,
    main,
    children,
    onClick,
  }: {
    leading?: React.ReactNode;
    main?: React.ReactNode;
    children?: React.ReactNode;
    onClick?: React.MouseEventHandler<HTMLDivElement>;
  }) => (
    <div role="button" onClick={onClick}>
      {leading}
      {main}
      {children}
    </div>
  ),
}));

describe('NotesTagsSection', () => {
  beforeEach(() => {
    mocked.readFile.mockReset();
    mocked.stat.mockReset();
    mocked.noteIcon.mockClear();
    mocked.stat.mockResolvedValue(null);
  });

  it('does not parse tag note icon metadata that exceeds the limit after read', async () => {
    mocked.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValue(['---', 'vlaina_icon: "💡"', '---', 'x'.repeat(512 * 1024 + 1)].join('\n'));

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'docs/alpha.md', query: '#topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('topic'));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledWith('/vault/docs/alpha.md');
    });
    expect(mocked.noteIcon).not.toHaveBeenCalled();
    expect(screen.getByTestId('fallback-icon')).toHaveTextContent('file.text');
  });

  it('does not read tag note icon metadata from unsafe relative paths', async () => {
    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: '../secret.md', query: '#topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('topic'));

    await waitFor(() => {
      expect(screen.getByTestId('fallback-icon')).toHaveTextContent('file.text');
    });
    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });
});
