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
};

describe('useCurrentVaultInitialization', () => {
  beforeEach(() => {
    baseProps.loadStarred.mockClear();
    baseProps.loadAssets.mockClear();
    baseProps.loadFileTree.mockClear();
    baseProps.cleanupAssetTempFiles.mockClear();
    baseProps.clearAssetUrlCache.mockClear();
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
