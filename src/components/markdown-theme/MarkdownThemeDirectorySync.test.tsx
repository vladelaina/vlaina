import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkdownThemeDirectorySync } from './MarkdownThemeDirectorySync';

type MarkdownThemeDirectorySyncMockStore = {
  loaded: boolean;
  setMarkdownImportedThemeId: (importedThemeId: string | null) => void;
  data: {
    settings: {
      markdown: {
        typewriterMode: boolean;
        theme: {
          importedThemeId: string | null;
        };
        body: {
          showLineNumbers: boolean;
        };
        codeBlock: {
          showLineNumbers: boolean;
        };
      };
    };
  };
};

const mocks = vi.hoisted(() => ({
  isElectronRuntime: vi.fn(),
  syncImportedMarkdownThemesFromDirectory: vi.fn(),
  watchDesktopPath: vi.fn(),
  store: {
    loaded: true,
    setMarkdownImportedThemeId: vi.fn(),
    data: {
      settings: {
        markdown: {
          typewriterMode: false,
          theme: {
            importedThemeId: null,
          },
          body: {
            showLineNumbers: false,
          },
          codeBlock: {
            showLineNumbers: false,
          },
        },
      },
    },
  } as MarkdownThemeDirectorySyncMockStore,
}));

vi.mock('@/lib/electron/bridge', () => ({
  isElectronRuntime: () => mocks.isElectronRuntime(),
}));

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: (...args: unknown[]) => mocks.watchDesktopPath(...args),
}));

vi.mock('@/lib/markdown/theme-compatibility/importedThemeStorage', () => ({
  syncImportedMarkdownThemesFromDirectory: (...args: unknown[]) =>
    mocks.syncImportedMarkdownThemesFromDirectory(...args),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => {
  const useUnifiedStore = (selector: (state: typeof mocks.store) => unknown) => selector(mocks.store);
  useUnifiedStore.getState = () => mocks.store;
  return { useUnifiedStore };
});

function setImportedThemeId(importedThemeId: string | null) {
  mocks.store.data.settings.markdown.theme = {
    importedThemeId,
  };
}

describe('MarkdownThemeDirectorySync', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mocks.store.loaded = true;
    setImportedThemeId(null);
    mocks.store.setMarkdownImportedThemeId = vi.fn((importedThemeId: string | null) => {
      setImportedThemeId(importedThemeId);
    });
    mocks.syncImportedMarkdownThemesFromDirectory.mockResolvedValue({
      directoryPath: '/app/.vlaina/themes',
      themes: [],
      activeThemeId: 'clean-light',
    });
    mocks.isElectronRuntime.mockReturnValue(false);
    mocks.watchDesktopPath.mockResolvedValue(vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not scan the fixed theme directory before unified settings are loaded', () => {
    mocks.store.loaded = false;

    render(<MarkdownThemeDirectorySync />);

    expect(mocks.syncImportedMarkdownThemesFromDirectory).not.toHaveBeenCalled();
    expect(mocks.store.setMarkdownImportedThemeId).not.toHaveBeenCalled();
  });

  it('syncs the fixed theme directory without overriding the default theme selection', async () => {
    render(<MarkdownThemeDirectorySync />);

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
    });
    expect(mocks.store.setMarkdownImportedThemeId).not.toHaveBeenCalled();
  });

  it('does not rewrite a manually selected synced theme id', async () => {
    setImportedThemeId('minimal');
    mocks.syncImportedMarkdownThemesFromDirectory.mockResolvedValueOnce({
      directoryPath: '/app/.vlaina/themes',
      themes: [
        { id: 'clean-light' },
        { id: 'minimal' },
      ],
      activeThemeId: 'clean-light',
    });

    render(<MarkdownThemeDirectorySync />);

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
    });
    expect(mocks.store.setMarkdownImportedThemeId).not.toHaveBeenCalled();
  });

  it('selects the active synced theme when the current selection disappeared', async () => {
    setImportedThemeId('deleted-theme');
    mocks.syncImportedMarkdownThemesFromDirectory.mockResolvedValueOnce({
      directoryPath: '/app/.vlaina/themes',
      themes: [
        { id: 'clean-light' },
      ],
      activeThemeId: 'clean-light',
    });

    render(<MarkdownThemeDirectorySync />);

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
      expect(mocks.store.setMarkdownImportedThemeId).toHaveBeenCalledWith('clean-light');
    });
  });

  it('watches the fixed theme directory in electron and refreshes after changes', async () => {
    let notifyChange: () => void = () => undefined;
    const unwatch = vi.fn(async () => undefined);
    setImportedThemeId('clean-light');
    mocks.isElectronRuntime.mockReturnValue(true);
    mocks.watchDesktopPath.mockImplementation(async (_path: string, callback: () => void) => {
      notifyChange = callback;
      return unwatch;
    });
    mocks.syncImportedMarkdownThemesFromDirectory
      .mockResolvedValueOnce({
        directoryPath: '/app/.vlaina/themes',
        themes: [
          { id: 'clean-light' },
        ],
        activeThemeId: 'clean-light',
      })
      .mockResolvedValueOnce({
        directoryPath: '/app/.vlaina/themes',
        themes: [
          { id: 'minimal' },
        ],
        activeThemeId: 'minimal',
      });

    render(<MarkdownThemeDirectorySync />);

    await waitFor(() => {
      expect(mocks.watchDesktopPath).toHaveBeenCalledWith('/app/.vlaina/themes', expect.any(Function));
    });

    notifyChange();

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(2);
      expect(mocks.store.setMarkdownImportedThemeId).toHaveBeenLastCalledWith('minimal');
    });
  });

  it('isolates rejected theme directory watcher cleanup', async () => {
    const unwatch = vi.fn(async () => {
      throw new Error('unwatch failed');
    });
    mocks.isElectronRuntime.mockReturnValue(true);
    mocks.watchDesktopPath.mockResolvedValueOnce(unwatch);

    const view = render(<MarkdownThemeDirectorySync />);

    await waitFor(() => {
      expect(mocks.watchDesktopPath).toHaveBeenCalledWith('/app/.vlaina/themes', expect.any(Function));
    });

    view.unmount();
    await Promise.resolve();

    expect(unwatch).toHaveBeenCalledTimes(1);
  });

  it('isolates synchronous theme directory watcher setup failures', async () => {
    mocks.isElectronRuntime.mockReturnValue(true);
    mocks.watchDesktopPath.mockImplementationOnce(() => {
      throw new Error('watch failed');
    });

    render(<MarkdownThemeDirectorySync />);

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
      expect(mocks.watchDesktopPath).toHaveBeenCalledWith('/app/.vlaina/themes', expect.any(Function));
    });
  });
});
