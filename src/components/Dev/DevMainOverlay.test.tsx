import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DevMainOverlay } from './DevMainOverlay';

const mocks = vi.hoisted(() => ({
  appViewMode: 'notes' as 'notes' | 'chat' | 'lab',
  devPlatformPreview: 'system' as 'system' | 'macos',
  colorMode: 'system' as 'system' | 'light' | 'dark',
  importedMarkdownThemeId: null as string | null,
  setAppViewMode: vi.fn(),
  toggleDevPlatformPreview: vi.fn(),
  setColorMode: vi.fn(),
  setMarkdownImportedThemeId: vi.fn(),
  listImportedMarkdownThemesFromDirectory: vi.fn(),
  syncImportedMarkdownThemesFromDirectory: vi.fn(),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('@/stores/uiSlice', () => {
  type UIState = {
    appViewMode: 'notes' | 'chat' | 'lab';
    devPlatformPreview: 'system' | 'macos';
    setAppViewMode: typeof mocks.setAppViewMode;
    toggleDevPlatformPreview: typeof mocks.toggleDevPlatformPreview;
  };

  const getState = (): UIState => ({
    appViewMode: mocks.appViewMode,
    devPlatformPreview: mocks.devPlatformPreview,
    setAppViewMode: mocks.setAppViewMode,
    toggleDevPlatformPreview: mocks.toggleDevPlatformPreview,
  });

  return {
    useUIStore: (selector: (state: UIState) => unknown) => selector(getState()),
  };
});

vi.mock('@/stores/unified/useUnifiedStore', () => {
  type UnifiedState = {
    data: {
      settings: {
        ui: {
          colorMode: 'system' | 'light' | 'dark';
        };
        markdown: {
          theme: {
            importedThemeId: string | null;
          };
        };
      };
    };
    setColorMode: typeof mocks.setColorMode;
    setMarkdownImportedThemeId: typeof mocks.setMarkdownImportedThemeId;
  };

  const getState = (): UnifiedState => ({
    data: {
      settings: {
        ui: {
          colorMode: mocks.colorMode,
        },
        markdown: {
          theme: {
            importedThemeId: mocks.importedMarkdownThemeId,
          },
        },
      },
    },
    setColorMode: mocks.setColorMode,
    setMarkdownImportedThemeId: mocks.setMarkdownImportedThemeId,
  });

  return {
    useUnifiedStore: (selector: (state: UnifiedState) => unknown) => selector(getState()),
  };
});

vi.mock('@/lib/markdown/theme-compatibility/importedThemeStorage', () => ({
  listImportedMarkdownThemesFromDirectory: (...args: unknown[]) =>
    mocks.listImportedMarkdownThemesFromDirectory(...args),
  syncImportedMarkdownThemesFromDirectory: (...args: unknown[]) =>
    mocks.syncImportedMarkdownThemesFromDirectory(...args),
}));

const themes = [
  {
    id: 'clean-light',
    name: 'Clean Light',
    platform: 'typora' as const,
    cssFile: 'clean-light.css',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    platform: 'obsidian' as const,
    cssFile: 'minimal.css',
    createdAt: 2,
    updatedAt: 2,
  },
];

describe('DevMainOverlay', () => {
  beforeEach(() => {
    mocks.appViewMode = 'notes';
    mocks.devPlatformPreview = 'system';
    mocks.colorMode = 'system';
    mocks.importedMarkdownThemeId = null;
    mocks.listImportedMarkdownThemesFromDirectory.mockResolvedValue(themes);
    mocks.syncImportedMarkdownThemesFromDirectory.mockResolvedValue({
      directoryPath: '/app/.vlaina/themes',
      themes,
      activeThemeId: 'clean-light',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('cycles from the default markdown theme to the first imported theme', async () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Switch Markdown theme (default)',
    }));

    await waitFor(() => {
      expect(mocks.setMarkdownImportedThemeId).toHaveBeenCalledWith('clean-light');
    });
    expect(mocks.syncImportedMarkdownThemesFromDirectory).not.toHaveBeenCalled();
  });

  it('cycles imported markdown themes and returns to the default theme', async () => {
    mocks.importedMarkdownThemeId = 'clean-light';
    render(<DevMainOverlay effectiveAppViewMode="notes" />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Switch Markdown theme (clean-light)',
    }));

    await waitFor(() => {
      expect(mocks.setMarkdownImportedThemeId).toHaveBeenCalledWith('minimal');
    });

    cleanup();
    mocks.setMarkdownImportedThemeId.mockClear();
    mocks.importedMarkdownThemeId = 'minimal';
    render(<DevMainOverlay effectiveAppViewMode="notes" />);

    fireEvent.click(screen.getByRole('button', {
      name: 'Switch Markdown theme (minimal)',
    }));

    await waitFor(() => {
      expect(mocks.setMarkdownImportedThemeId).toHaveBeenCalledWith(null);
    });
  });

  it('syncs the fixed theme directory when the cached directory list is empty', async () => {
    mocks.listImportedMarkdownThemesFromDirectory.mockResolvedValue([]);

    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    fireEvent.click(screen.getByRole('button', {
      name: 'Switch Markdown theme (default)',
    }));

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
      expect(mocks.setMarkdownImportedThemeId).toHaveBeenCalledWith('clean-light');
    });
  });

  it('keeps the existing dev color mode and Lab shortcuts working', () => {
    mocks.colorMode = 'dark';
    render(<DevMainOverlay effectiveAppViewMode="notes" />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Design Lab' }));

    expect(mocks.setColorMode).toHaveBeenCalledWith('light');
    expect(mocks.setAppViewMode).toHaveBeenCalledWith('lab');
  });

  it('toggles the macOS titlebar platform preview', () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview macOS titlebar' }));

    expect(mocks.toggleDevPlatformPreview).toHaveBeenCalledTimes(1);
  });

  it('hides the Lab shortcut while already in the Lab view', () => {
    render(<DevMainOverlay effectiveAppViewMode="lab" />);

    expect(screen.queryByRole('button', { name: 'Open Design Lab' })).not.toBeInTheDocument();
  });
});
