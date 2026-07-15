import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { clearNoteCoverSnapshotCacheForTests } from '@/components/Notes/features/Cover/noteCoverSnapshot';
import { useDisplayCoverAssetPath } from './useDisplayCover';

describe('useDisplayCoverAssetPath', () => {
  beforeEach(() => {
    useNotesStore.setState(useNotesStore.getInitialState(), true);
    useUIStore.setState(useUIStore.getInitialState(), true);
    clearNoteCoverSnapshotCacheForTests();
  });

  it('uses a temporary cover preview and returns to committed metadata', () => {
    act(() => {
      useNotesStore.setState({
        notesPath: '/notesRoot',
        noteMetadata: {
          version: 2,
          notes: {
            'demo.md': { cover: { assetPath: 'covers/current.webp' } },
          },
        },
      });
    });
    const { result } = renderHook(() => useDisplayCoverAssetPath('demo.md'));
    expect(result.current).toBe('covers/current.webp');

    act(() => {
      useUIStore.getState().setUniversalPreview('demo.md', {
        cover: 'covers/preview.gif',
      });
    });
    expect(result.current).toBe('covers/preview.gif');

    act(() => {
      useNotesStore.setState({
        noteMetadata: {
          version: 2,
          notes: {
            'demo.md': { cover: { assetPath: 'covers/next.webp' } },
          },
        },
      });
      useUIStore.getState().setUniversalPreview(null, { cover: null });
    });
    expect(result.current).toBe('covers/next.webp');
  });

  it('does not apply another note preview', () => {
    const { result } = renderHook(() => useDisplayCoverAssetPath('demo.md'));

    act(() => {
      useUIStore.getState().setUniversalPreview('other.md', {
        cover: 'covers/other.webp',
      });
    });

    expect(result.current).toBeUndefined();
  });
});
