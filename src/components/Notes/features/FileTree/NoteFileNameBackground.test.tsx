import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { clearNoteCoverSnapshotCacheForTests } from '../Cover/noteCoverSnapshot';
import { NoteFileNameBackground } from './NoteFileNameBackground';

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageThumbnailAsBlob: vi.fn(async (path: string) => `blob:${path}`),
}));

vi.mock('@/stores/notes/utils/fs/notesRootPathContainment', () => ({
  resolveNotesRootRelativeFullPath: vi.fn(async (notesPath: string, path: string) => ({
    fullPath: `${notesPath}/${path}`,
    relativePath: path,
  })),
}));

describe('NoteFileNameBackground', () => {
  beforeEach(() => {
    useNotesStore.setState(useNotesStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
    clearNoteCoverSnapshotCacheForTests();
  });

  it('updates only the background child during cover preview and commit', async () => {
    act(() => {
      useNotesStore.setState({
        notesPath: '/notesRoot',
        noteMetadata: {
          version: 2,
          notes: { 'demo.md': { cover: { assetPath: 'covers/current.webp' } } },
        },
      });
    });
    let parentRenders = 0;
    function Harness() {
      parentRenders += 1;
      return <NoteFileNameBackground notePath="demo.md" notesPath="/notesRoot" />;
    }
    const { container } = render(<Harness />);
    await waitFor(() => {
      expect(container.querySelector('[data-file-tree-image-background="covers/current.webp"]')).toBeInTheDocument();
    });

    act(() => {
      useUIStore.getState().setUniversalPreview('demo.md', { cover: 'covers/preview.gif' });
    });
    await waitFor(() => {
      expect(container.querySelector('[data-file-tree-image-background="covers/preview.gif"]')).toBeInTheDocument();
    });
    expect(parentRenders).toBe(1);

    act(() => {
      useNotesStore.setState({
        noteMetadata: {
          version: 2,
          notes: { 'demo.md': { cover: { assetPath: 'covers/next.webp' } } },
        },
      });
      useUIStore.getState().setUniversalPreview(null, { cover: null });
    });
    await waitFor(() => {
      expect(container.querySelector('[data-file-tree-image-background="covers/next.webp"]')).toBeInTheDocument();
    });
    expect(parentRenders).toBe(1);
  });
});
