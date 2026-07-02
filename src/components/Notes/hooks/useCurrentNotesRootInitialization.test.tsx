import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentNotesRootInitialization } from './useCurrentNotesRootInitialization';

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: {
    setResizable: vi.fn().mockResolvedValue(undefined),
  },
}));

const baseProps = {
  currentNotesRootPath: '/notesRoot',
  launchNotePath: null,
  pendingStarredNavigation: null,
  pendingOpenMarkdownTargetNotesRootPath: null,
  loadStarred: vi.fn().mockResolvedValue(undefined),
  loadAssets: vi.fn().mockResolvedValue(undefined),
  loadFileTree: vi.fn().mockResolvedValue(undefined),
  cleanupAssetTempFiles: vi.fn().mockResolvedValue(undefined),
  clearAssetUrlCache: vi.fn(),
  clearRemoteImageMemoryCache: vi.fn(),
  cancelNoteContentScan: vi.fn(),
};

describe('useCurrentNotesRootInitialization', () => {
  beforeEach(() => {
    baseProps.loadStarred.mockClear();
    baseProps.loadAssets.mockClear();
    baseProps.loadFileTree.mockClear();
    baseProps.cleanupAssetTempFiles.mockClear();
    baseProps.clearAssetUrlCache.mockClear();
    baseProps.clearRemoteImageMemoryCache.mockClear();
    baseProps.cancelNoteContentScan.mockClear();
  });

  it('skips workspace restore while opening a pending markdown target notesRoot', async () => {
    renderHook(() => useCurrentNotesRootInitialization({
      ...baseProps,
      pendingOpenMarkdownTargetNotesRootPath: '/notesRoot',
    }));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(true);
    });
  });

  it('keeps workspace restore enabled for ordinary notesRoot initialization', async () => {
    renderHook(() => useCurrentNotesRootInitialization(baseProps));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(false);
    });
  });

  it('does not wait for starred loading before starting the file tree load', async () => {
    baseProps.loadStarred.mockImplementationOnce(() => new Promise<void>(() => undefined));

    renderHook(() => useCurrentNotesRootInitialization(baseProps));

    await waitFor(() => {
      expect(baseProps.loadStarred).toHaveBeenCalledWith('/notesRoot');
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(false);
    });
  });

  it('does not preload assets during notesRoot initialization', async () => {
    renderHook(() => useCurrentNotesRootInitialization(baseProps));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(false);
    });

    expect(baseProps.loadAssets).not.toHaveBeenCalled();
  });

  it('does not reload the notesRoot when a consumed starred navigation is cleared', async () => {
    const { rerender } = renderHook(
      ({ currentNotesRootPath, pendingStarredNavigation }) => useCurrentNotesRootInitialization({
        ...baseProps,
        currentNotesRootPath,
        pendingStarredNavigation,
      }),
      {
        initialProps: {
          currentNotesRootPath: '/notesRoot' as string | null,
          pendingStarredNavigation: {
            notesRootPath: '/notesRoot',
            skipWorkspaceRestore: true,
          },
        } as {
          currentNotesRootPath: string | null;
          pendingStarredNavigation: {
            notesRootPath: string;
            skipWorkspaceRestore?: boolean;
          } | null;
        },
      },
    );

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(true);
    });
    expect(baseProps.loadFileTree).toHaveBeenCalledTimes(1);

    rerender({ currentNotesRootPath: '/notesRoot', pendingStarredNavigation: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(baseProps.loadFileTree).toHaveBeenCalledTimes(1);
    expect(baseProps.clearAssetUrlCache).not.toHaveBeenCalled();
    expect(baseProps.clearRemoteImageMemoryCache).not.toHaveBeenCalled();
    expect(baseProps.cancelNoteContentScan).not.toHaveBeenCalled();

    rerender({ currentNotesRootPath: null, pendingStarredNavigation: null });
    rerender({ currentNotesRootPath: '/notesRoot', pendingStarredNavigation: null });

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledTimes(2);
    });
    expect(baseProps.loadFileTree).toHaveBeenLastCalledWith(false);
  });

  it('releases transient caches and cancels content scans when the notesRoot effect is cleaned up', async () => {
    const { unmount } = renderHook(() => useCurrentNotesRootInitialization(baseProps));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(false);
    });

    unmount();

    expect(baseProps.cancelNoteContentScan).toHaveBeenCalledTimes(1);
    expect(baseProps.clearAssetUrlCache).toHaveBeenCalledTimes(1);
    expect(baseProps.clearRemoteImageMemoryCache).toHaveBeenCalledTimes(1);
  });

  it('reports initialization while notesRoot loading is in flight', async () => {
    let resolveLoadFileTree: () => void = () => undefined;
    const onInitializingChange = vi.fn();
    baseProps.loadFileTree.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveLoadFileTree = resolve;
    }));

    renderHook(() => useCurrentNotesRootInitialization({
      ...baseProps,
      onInitializingChange,
    }));

    await waitFor(() => {
      expect(onInitializingChange).toHaveBeenCalledWith(true);
    });
    expect(onInitializingChange).not.toHaveBeenCalledWith(false);

    resolveLoadFileTree();

    await waitFor(() => {
      expect(onInitializingChange).toHaveBeenLastCalledWith(false);
    });
  });
});
