import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentVaultInitialization } from './useCurrentVaultInitialization';

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: {
    setResizable: vi.fn().mockResolvedValue(undefined),
  },
}));

const baseProps = {
  currentVaultPath: '/vault',
  launchNotePath: null,
  pendingStarredNavigation: null,
  pendingOpenMarkdownTargetVaultPath: null,
  loadStarred: vi.fn().mockResolvedValue(undefined),
  loadAssets: vi.fn().mockResolvedValue(undefined),
  loadFileTree: vi.fn().mockResolvedValue(undefined),
  cleanupAssetTempFiles: vi.fn().mockResolvedValue(undefined),
  clearAssetUrlCache: vi.fn(),
  clearRemoteImageMemoryCache: vi.fn(),
  cancelNoteContentScan: vi.fn(),
};

describe('useCurrentVaultInitialization', () => {
  beforeEach(() => {
    baseProps.loadStarred.mockClear();
    baseProps.loadAssets.mockClear();
    baseProps.loadFileTree.mockClear();
    baseProps.cleanupAssetTempFiles.mockClear();
    baseProps.clearAssetUrlCache.mockClear();
    baseProps.clearRemoteImageMemoryCache.mockClear();
    baseProps.cancelNoteContentScan.mockClear();
  });

  it('skips workspace restore while opening a pending markdown target vault', async () => {
    renderHook(() => useCurrentVaultInitialization({
      ...baseProps,
      pendingOpenMarkdownTargetVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(true);
    });
  });

  it('keeps workspace restore enabled for ordinary vault initialization', async () => {
    renderHook(() => useCurrentVaultInitialization(baseProps));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(false);
    });
  });

  it('does not reload the vault when a consumed starred navigation is cleared', async () => {
    const { rerender } = renderHook(
      ({ currentVaultPath, pendingStarredNavigation }) => useCurrentVaultInitialization({
        ...baseProps,
        currentVaultPath,
        pendingStarredNavigation,
      }),
      {
        initialProps: {
          currentVaultPath: '/vault' as string | null,
          pendingStarredNavigation: {
            vaultPath: '/vault',
            skipWorkspaceRestore: true,
          },
        } as {
          currentVaultPath: string | null;
          pendingStarredNavigation: {
            vaultPath: string;
            skipWorkspaceRestore?: boolean;
          } | null;
        },
      },
    );

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(true);
    });
    expect(baseProps.loadFileTree).toHaveBeenCalledTimes(1);

    rerender({ currentVaultPath: '/vault', pendingStarredNavigation: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(baseProps.loadFileTree).toHaveBeenCalledTimes(1);
    expect(baseProps.clearAssetUrlCache).not.toHaveBeenCalled();
    expect(baseProps.clearRemoteImageMemoryCache).not.toHaveBeenCalled();
    expect(baseProps.cancelNoteContentScan).not.toHaveBeenCalled();

    rerender({ currentVaultPath: null, pendingStarredNavigation: null });
    rerender({ currentVaultPath: '/vault', pendingStarredNavigation: null });

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledTimes(2);
    });
    expect(baseProps.loadFileTree).toHaveBeenLastCalledWith(false);
  });

  it('releases transient caches and cancels content scans when the vault effect is cleaned up', async () => {
    const { unmount } = renderHook(() => useCurrentVaultInitialization(baseProps));

    await waitFor(() => {
      expect(baseProps.loadFileTree).toHaveBeenCalledWith(false);
    });

    unmount();

    expect(baseProps.cancelNoteContentScan).toHaveBeenCalledTimes(1);
    expect(baseProps.clearAssetUrlCache).toHaveBeenCalledTimes(1);
    expect(baseProps.clearRemoteImageMemoryCache).toHaveBeenCalledTimes(1);
  });

  it('reports initialization while vault loading is in flight', async () => {
    let resolveLoadFileTree: () => void = () => undefined;
    const onInitializingChange = vi.fn();
    baseProps.loadFileTree.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveLoadFileTree = resolve;
    }));

    renderHook(() => useCurrentVaultInitialization({
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
