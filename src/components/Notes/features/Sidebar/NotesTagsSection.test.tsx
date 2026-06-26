import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS, NotesTagsSection } from './NotesTagsSection';

const MAX_TAG_NOTE_ICON_METADATA_BYTES = 512 * 1024;

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
  stat: vi.fn(async (): Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number; size?: number } | null> => null),
  noteIcon: vi.fn(({ icon }: { icon: string }) => <span data-testid="note-icon">{icon}</span>),
  notesPath: '/vault',
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
  useNotesStore: (selector: (state: { notesPath: string }) => unknown) => selector({ notesPath: mocked.notesPath }),
}));

vi.mock('@/hooks/useTitleSync', () => ({
  useDisplayIcon: () => undefined,
  useDisplayName: () => undefined,
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
  getSidebarCollapseTriangleColorClassName: () => '',
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
    mocked.notesPath = '/vault';
  });

  it('does not parse tag note icon metadata that exceeds the limit after read', async () => {
    mocked.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValue([
      '---',
      'vlaina_icon: "💡"',
      '---',
      '你'.repeat(Math.floor(MAX_TAG_NOTE_ICON_METADATA_BYTES / 3) + 1),
    ].join('\n'));

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
      expect(mocked.readFile).toHaveBeenCalledWith('/vault/docs/alpha.md', MAX_TAG_NOTE_ICON_METADATA_BYTES);
    });
    expect(mocked.noteIcon).not.toHaveBeenCalled();
    expect(screen.getByTestId('fallback-icon')).toHaveTextContent('file.text');
  });

  it('reads tag note icon metadata with bounded reads when stat has no size', async () => {
    mocked.stat.mockResolvedValue({ isFile: true, isDirectory: false });
    mocked.readFile.mockResolvedValue('---\nvlaina_icon: "💡"\n---\n# Alpha');

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'docs/no-size-icon.md', query: '#topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('💡');
    });
    expect(mocked.readFile).toHaveBeenCalledWith('/vault/docs/no-size-icon.md', MAX_TAG_NOTE_ICON_METADATA_BYTES);
  });

  it('does not read tag note icon metadata when stat reports an invalid negative size', async () => {
    mocked.stat.mockResolvedValue({ isFile: true, isDirectory: false, modifiedAt: 1, size: -1 });

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'docs/invalid-size-icon.md', query: '#topic', contentMatchOrdinal: 0 }],
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
    expect(mocked.readFile).not.toHaveBeenCalled();
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

  it('does not read tag note icon metadata from non-Markdown paths', async () => {
    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'docs/image.png', query: '#topic', contentMatchOrdinal: 0 }],
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

  it('does not read tag note icon metadata from unsafe absolute paths', async () => {
    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: '/vault/secret\u202Egnp.md', query: '#topic', contentMatchOrdinal: 0 }],
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

  it('does not read tag note icon metadata from internal relative paths', async () => {
    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'docs/.git/config.md', query: '#topic', contentMatchOrdinal: 0 }],
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

  it('does not read tag note icon metadata from case-variant internal relative paths', async () => {
    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'docs/.GIT/config.md', query: '#topic', contentMatchOrdinal: 0 }],
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

  it('does not read tag note icon metadata from internal vault paths', async () => {
    mocked.notesPath = '/vault/.vlaina';

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'workspace.md', query: '#topic', contentMatchOrdinal: 0 }],
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

  it('does not read tag note icon metadata from case-variant internal vault paths', async () => {
    mocked.notesPath = '/vault/.VLAINA';

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'topic',
            count: 1,
            paths: [{ path: 'workspace.md', query: '#topic', contentMatchOrdinal: 0 }],
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

  it('limits concurrent tag note icon metadata reads', async () => {
    mocked.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 32 });
    const readResolvers: Array<(content: string) => void> = [];
    mocked.readFile.mockImplementation(
      () => new Promise<string>((resolve) => {
        readResolvers.push(resolve);
      }),
    );
    const rowCount = MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS + 3;

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'fanout-topic',
            count: rowCount,
            paths: Array.from({ length: rowCount }, (_, index) => ({
              path: `docs/fanout-${index}.md`,
              query: '#fanout-topic',
              contentMatchOrdinal: index,
            })),
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('fanout-topic'));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledTimes(MAX_CONCURRENT_TAG_NOTE_ICON_METADATA_READS);
    });

    const firstBatch = readResolvers.slice();
    firstBatch.forEach((resolve) => resolve('---\nvlaina_icon: "💡"\n---\n# Note'));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledTimes(rowCount);
    });

    readResolvers
      .slice(firstBatch.length)
      .forEach((resolve) => resolve('---\nvlaina_icon: "💡"\n---\n# Note'));

    await waitFor(() => {
      expect(screen.getAllByTestId('note-icon')).toHaveLength(rowCount);
    });
  });

  it('reloads cached tag note icon metadata when file metadata changes', async () => {
    mocked.stat.mockResolvedValueOnce({ isFile: true, modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = render(
      <NotesTagsSection
        tags={[
          {
            tag: 'cache-topic',
            count: 1,
            paths: [{ path: 'docs/cached-tag-icon.md', query: '#cache-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('cache-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('💡');
    });
    first.unmount();

    mocked.noteIcon.mockClear();
    mocked.stat.mockResolvedValueOnce({ isFile: true, modifiedAt: 2, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "📘"\n---\n# Alpha');

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'cache-topic',
            count: 1,
            paths: [{ path: 'docs/cached-tag-icon.md', query: '#cache-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('cache-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('📘');
    });
    expect(mocked.readFile).toHaveBeenCalledTimes(2);
  });

  it('does not reuse cached tag note icon metadata when stat has size but no modified time', async () => {
    mocked.stat.mockResolvedValueOnce({ isFile: true, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = render(
      <NotesTagsSection
        tags={[
          {
            tag: 'no-mtime-cache-topic',
            count: 1,
            paths: [{ path: 'docs/no-mtime-tag-icon.md', query: '#no-mtime-cache-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('no-mtime-cache-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('💡');
    });
    first.unmount();

    mocked.noteIcon.mockClear();
    mocked.stat.mockResolvedValueOnce({ isFile: true, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "📘"\n---\n# Alpha');

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'no-mtime-cache-topic',
            count: 1,
            paths: [{ path: 'docs/no-mtime-tag-icon.md', query: '#no-mtime-cache-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('no-mtime-cache-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('📘');
    });
    expect(mocked.readFile).toHaveBeenCalledTimes(2);
  });

  it('does not reuse cached tag note icon metadata when stat has an invalid modified time', async () => {
    mocked.stat.mockResolvedValueOnce({ isFile: true, modifiedAt: Number.POSITIVE_INFINITY, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = render(
      <NotesTagsSection
        tags={[
          {
            tag: 'invalid-mtime-cache-topic',
            count: 1,
            paths: [{ path: 'docs/invalid-mtime-tag-icon.md', query: '#invalid-mtime-cache-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('invalid-mtime-cache-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('💡');
    });
    first.unmount();

    mocked.noteIcon.mockClear();
    mocked.stat.mockResolvedValueOnce({ isFile: true, modifiedAt: Number.POSITIVE_INFINITY, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "📘"\n---\n# Alpha');

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'invalid-mtime-cache-topic',
            count: 1,
            paths: [{ path: 'docs/invalid-mtime-tag-icon.md', query: '#invalid-mtime-cache-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('invalid-mtime-cache-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('📘');
    });
    expect(mocked.readFile).toHaveBeenCalledTimes(2);
  });

  it('does not reuse cached tag note icon metadata after the path stops being a readable file', async () => {
    mocked.stat.mockResolvedValueOnce({ isFile: true, modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = render(
      <NotesTagsSection
        tags={[
          {
            tag: 'gone-topic',
            count: 1,
            paths: [{ path: 'docs/gone-tag-icon.md', query: '#gone-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('gone-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('note-icon')).toHaveTextContent('💡');
    });
    first.unmount();

    mocked.noteIcon.mockClear();
    mocked.stat.mockResolvedValueOnce({ isFile: false, modifiedAt: 1, size: 32 });

    render(
      <NotesTagsSection
        tags={[
          {
            tag: 'gone-topic',
            count: 1,
            paths: [{ path: 'docs/gone-tag-icon.md', query: '#gone-topic', contentMatchOrdinal: 0 }],
          },
        ]}
        getDisplayName={(path) => path}
        onOpenNote={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByText('gone-topic'));

    await waitFor(() => {
      expect(screen.getByTestId('fallback-icon')).toHaveTextContent('file.text');
    });
    expect(screen.queryByTestId('note-icon')).toBeNull();
    expect(mocked.readFile).toHaveBeenCalledTimes(1);
  });
});
