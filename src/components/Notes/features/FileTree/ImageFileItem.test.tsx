import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageFileItem } from './ImageFileItem';

const hoisted = vi.hoisted(() => ({
  addToast: vi.fn(),
  deleteImage: vi.fn(async () => undefined),
  findImageFileReferences: vi.fn(async () => []),
  navigateToImageFileReference: vi.fn(async () => true),
  renameImage: vi.fn(async () => 'images/renamed.png'),
  openNote: vi.fn(async () => undefined),
  loadImageAsBlob: vi.fn(async () => 'blob:image-preview'),
  resolveNotesRootRelativeFullPath: vi.fn(async () => ({
    fullPath: '/notesRoot/images/cover.png',
    relativePath: 'images/cover.png',
  })),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: Object.assign((selector: (state: Record<string, unknown>) => unknown) => selector({
    notesPath: '/notesRoot',
    deleteImage: hoisted.deleteImage,
    renameImage: hoisted.renameImage,
    openNote: hoisted.openNote,
    getDisplayName: (path: string) => path,
  }), {
    getState: () => ({
      notesPath: '/notesRoot',
      rootFolder: null,
      currentNote: null,
      noteContentsCache: new Map(),
      noteMetadata: null,
    }),
  }),
}));

vi.mock('../Sidebar/SidebarNoteFileIcon', () => ({
  SidebarLiveNoteFileIcon: ({ notePath }: { notePath: string }) => (
    <span data-testid={`note-icon-${notePath}`} />
  ),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof hoisted.addToast }) => unknown) => selector({
    addToast: hoisted.addToast,
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
  translate: (key: string) => key,
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('./ImageFileNameBackground', () => ({
  ImageFileNameBackground: () => <span data-testid="image-background" />,
}));

vi.mock('./imageFileReferences', () => ({
  findImageFileReferences: hoisted.findImageFileReferences,
}));

vi.mock('./imageFileReferenceNavigation', () => ({
  navigateToImageFileReference: hoisted.navigateToImageFileReference,
}));

vi.mock('@/stores/notes/utils/fs/notesRootPathContainment', () => ({
  resolveNotesRootRelativeFullPath: hoisted.resolveNotesRootRelativeFullPath,
}));

vi.mock('@/components/Chat/features/Markdown/components/LazyChatImageViewer', () => ({
  LazyChatImageViewer: ({ open, src, alt }: { open: boolean; src: string; alt?: string }) => (
    open ? <div data-testid="image-viewer" data-src={src}>{alt}</div> : null
  ),
}));

describe('ImageFileItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.loadImageAsBlob.mockResolvedValue('blob:image-preview');
    hoisted.findImageFileReferences.mockResolvedValue([]);
  });

  it('loads and opens a notesRoot image without opening it as a note', async () => {
    render(
      <ImageFileItem
        node={{
          id: 'images/cover.png',
          name: 'cover.png',
          path: 'images/cover.png',
          isFolder: false,
          kind: 'image',
        }}
        depth={1}
        parentFolderPath="images"
      />
    );

    fireEvent.click(screen.getByText('cover.png'));

    await waitFor(() => expect(screen.getByTestId('image-viewer')).toBeInTheDocument());
    expect(hoisted.resolveNotesRootRelativeFullPath).toHaveBeenCalledWith(
      '/notesRoot',
      'images/cover.png',
    );
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/notesRoot/images/cover.png');
    expect(screen.getByTestId('image-viewer')).toHaveAttribute('data-src', 'blob:image-preview');
  });

  it('reports preview load failures without opening the viewer', async () => {
    hoisted.loadImageAsBlob.mockRejectedValueOnce(new Error('broken image'));
    render(
      <ImageFileItem
        node={{
          id: 'broken.png',
          name: 'broken.png',
          path: 'broken.png',
          isFolder: false,
          kind: 'image',
        }}
        depth={0}
      />
    );

    fireEvent.click(screen.getByText('broken.png'));

    await waitFor(() => {
      expect(hoisted.addToast).toHaveBeenCalledWith('editor.imageFailedToLoad', 'error');
    });
    expect(screen.queryByTestId('image-viewer')).not.toBeInTheDocument();
  });

  it('replaces the reference loading state when the scan completes', async () => {
    render(
      <ImageFileItem
        node={{
          id: 'cover.webp',
          name: 'cover.webp',
          path: 'cover.webp',
          isFolder: false,
          kind: 'image',
        }}
        depth={0}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'sidebar.openFileMenu' }));

    await waitFor(() => {
      expect(screen.getByText('notes.imageReferences (0)')).toBeInTheDocument();
    });
    expect(hoisted.findImageFileReferences).toHaveBeenCalledTimes(1);
  });

  it('renames an image from the inline sidebar editor', async () => {
    render(
      <ImageFileItem
        node={{
          id: 'images/cover.png',
          name: 'cover.png',
          path: 'images/cover.png',
          isFolder: false,
          kind: 'image',
        }}
        depth={1}
      />
    );

    fireEvent.doubleClick(screen.getByText('cover.png'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'renamed.png' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(hoisted.renameImage).toHaveBeenCalledWith('images/cover.png', 'renamed.png');
    });
  });
});
