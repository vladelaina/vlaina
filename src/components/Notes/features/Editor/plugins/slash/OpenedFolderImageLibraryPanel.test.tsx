import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenedFolderImageLibraryPanel } from './OpenedFolderImageLibraryPanel';

const hoisted = vi.hoisted(() => ({
  children: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    notesPath: '/notesRoot',
    rootFolder: {
      children: hoisted.children,
    },
  }),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageThumbnailAsBlob: vi.fn(async (path: string) => `blob:${path}`),
}));

vi.mock('@/stores/notes/utils/fs/notesRootPathContainment', () => ({
  resolveNotesRootRelativeFullPath: vi.fn(async (_notesPath: string, path: string) => ({
    fullPath: `/notesRoot/${path}`,
    relativePath: path,
  })),
}));

describe('OpenedFolderImageLibraryPanel', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 360,
      height: 360,
      left: 0,
      right: 400,
      top: 0,
      width: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    hoisted.children.splice(0, hoisted.children.length,
      { id: 'cover.png', name: 'cover.png', path: 'cover.png', isFolder: false, kind: 'image' },
      {
        id: 'b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif',
        name: 'b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif',
        path: 'b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif',
        isFolder: false,
        kind: 'image',
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens with the shared search field focused and filters without a search button', async () => {
    render(
      <OpenedFolderImageLibraryPanel
        onChooseComputer={() => undefined}
        onSelect={() => undefined}
      />,
    );

    const searchInput = screen.getByPlaceholderText('editor.imageLibrarySearchPlaceholder');
    await waitFor(() => expect(searchInput).toHaveFocus());
    expect(screen.queryByText('editor.imageLibraryTitle')).toBeNull();
    expect(screen.queryByText('editor.imageLibraryDescription')).toBeNull();
    expect(screen.queryByRole('button', { name: /search/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'editor.imageLibraryChooseComputer' })).not.toHaveClass(
      'bg-[var(--vlaina-color-inverse-surface)]',
    );

    fireEvent.change(searchInput, { target: { value: 'b6aaf' } });
    expect(document.querySelector(
      '[data-image-library-item="b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif"]',
    )).toBeInTheDocument();
    expect(document.querySelector('.slash-image-library-scroll')).toHaveClass('overflow-y-auto');
    expect(screen.queryByText('b6aaf51dac026c53249b1b5cf4f77ca68c29b060.gif')).toBeNull();
    expect(screen.queryByText('cover.png')).toBeNull();
  });

  it('mounts only a small visible window for large folders', async () => {
    hoisted.children.splice(0, hoisted.children.length, ...Array.from(
      { length: 5000 },
      (_value, index) => ({
        id: `image-${index}.webp`,
        name: `image-${index}.webp`,
        path: `image-${index}.webp`,
        isFolder: false,
        kind: 'image',
      }),
    ));

    const { container } = render(
      <OpenedFolderImageLibraryPanel
        onChooseComputer={() => undefined}
        onSelect={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-image-library-total-count="5000"]')).toBeInTheDocument();
      expect(container.querySelectorAll('[data-image-library-item]').length).toBeGreaterThan(0);
    });
    expect(container.querySelectorAll('[data-image-library-item]').length).toBeLessThan(50);
  });
});
