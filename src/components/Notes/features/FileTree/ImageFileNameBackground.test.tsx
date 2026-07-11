import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageFileNameBackground } from './ImageFileNameBackground';

const hoisted = vi.hoisted(() => ({
  loadImageThumbnailAsBlob: vi.fn(async () => 'blob:tree-background'),
  resolveNotesRootRelativeFullPath: vi.fn(async () => ({
    fullPath: '/notesRoot/assets/cover.png',
    relativePath: 'assets/cover.png',
  })),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageThumbnailAsBlob: hoisted.loadImageThumbnailAsBlob,
}));

vi.mock('@/stores/notes/utils/fs/notesRootPathContainment', () => ({
  resolveNotesRootRelativeFullPath: hoisted.resolveNotesRootRelativeFullPath,
}));

describe('ImageFileNameBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads a small image and renders it behind the file name', async () => {
    const { container } = render(
      <ImageFileNameBackground notesPath="/notesRoot" imagePath="assets/cover.png" />
    );

    await waitFor(() => {
      expect(container.querySelector('[style*="blob:tree-background"]')).toBeInTheDocument();
    });
    expect(container.querySelector('[data-file-tree-image-background="assets/cover.png"]')).toBeInTheDocument();
    expect(hoisted.loadImageThumbnailAsBlob).toHaveBeenCalledWith(
      '/notesRoot/assets/cover.png',
      { maxEdgePx: 64 },
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
