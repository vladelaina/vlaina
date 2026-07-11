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
  writeTextToClipboard: vi.fn(),
  getDiagnosticsLogText: vi.fn(),
  getDiagnosticsEntryCount: vi.fn(),
  clearDiagnosticsLog: vi.fn(),
  subscribeDiagnostics: vi.fn(),
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

vi.mock('@/lib/clipboard', () => ({
  writeTextToClipboard: (...args: unknown[]) => mocks.writeTextToClipboard(...args),
}));

vi.mock('@/lib/diagnostics/diagnosticsLog', () => ({
  clearDiagnosticsLog: (...args: unknown[]) => mocks.clearDiagnosticsLog(...args),
  getDiagnosticsEntryCount: () => mocks.getDiagnosticsEntryCount(),
  getDiagnosticsLogText: () => mocks.getDiagnosticsLogText(),
  subscribeDiagnostics: (...args: unknown[]) => mocks.subscribeDiagnostics(...args),
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

function expandDevelopmentTools() {
  fireEvent.click(screen.getByRole('button', { name: 'Expand development tools' }));
}

describe('DevMainOverlay', () => {
  beforeEach(() => {
    mocks.appViewMode = 'notes';
    mocks.devPlatformPreview = 'system';
    mocks.colorMode = 'system';
    mocks.importedMarkdownThemeId = null;
    mocks.writeTextToClipboard.mockResolvedValue(true);
    mocks.getDiagnosticsLogText.mockReturnValue('diagnostics-log');
    mocks.getDiagnosticsEntryCount.mockReturnValue(2);
    mocks.subscribeDiagnostics.mockReturnValue(() => undefined);
    mocks.listImportedMarkdownThemesFromDirectory.mockResolvedValue(themes);
    mocks.syncImportedMarkdownThemesFromDirectory.mockResolvedValue({
      directoryPath: '/app/.vlaina/app/themes',
      themes,
      activeThemeId: 'clean-light',
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('cycles from the default markdown theme to the first imported theme', async () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

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
    expandDevelopmentTools();

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
    expandDevelopmentTools();

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
    expandDevelopmentTools();
    fireEvent.click(screen.getByRole('button', {
      name: 'Switch Markdown theme (default)',
    }));

    await waitFor(() => {
      expect(mocks.syncImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
      expect(mocks.setMarkdownImportedThemeId).toHaveBeenCalledWith('clean-light');
    });
  });

  it('collapses the dev action column behind one expand button', () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);

    expect(screen.getByRole('button', { name: 'Expand development tools' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Preview error screen' })).not.toBeInTheDocument();

    expandDevelopmentTools();

    expect(screen.getByRole('button', { name: 'Collapse development tools' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview error screen' })).toBeInTheDocument();
  });

  it('puts copy logs above the simulated update download action', async () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

    const copyLogsButton = screen.getByRole('button', { name: 'Copy logs' });
    expect(screen.getByLabelText('2 diagnostics entries')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear logs' })).toBeInTheDocument();
    const downloadButton = screen.getByRole('button', { name: 'Simulate update available' });
    expect(Boolean(copyLogsButton.compareDocumentPosition(downloadButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.click(copyLogsButton);

    await waitFor(() => {
      expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('diagnostics-log');
    });
  });

  it('clears logs from the expanded diagnostics pill', () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

    fireEvent.click(screen.getByRole('button', { name: 'Clear logs' }));

    expect(mocks.clearDiagnosticsLog).toHaveBeenCalledTimes(1);
  });

  it('puts the retry test first and toggles it for chat requests', () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

    const retryButton = screen.getByRole('button', { name: 'Test retry' });
    const copyLogsButton = screen.getByRole('button', { name: 'Copy logs' });
    expect(Boolean(retryButton.compareDocumentPosition(copyLogsButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.click(retryButton);

    expect(window.localStorage.getItem('vlaina_dev_retry_simulation')).toBe('true');
    const enabledButton = screen.getByRole('button', { name: 'Test retry enabled' });

    fireEvent.click(enabledButton);

    expect(window.localStorage.getItem('vlaina_dev_retry_simulation')).toBeNull();
    expect(screen.getByRole('button', { name: 'Test retry' })).toBeInTheDocument();
  });

  it('keeps the existing dev color mode and Lab shortcuts working', () => {
    mocks.colorMode = 'dark';
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

    expect(screen.getByRole('button', { name: 'Preview error screen' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Design Lab' }));

    expect(mocks.setColorMode).toHaveBeenCalledWith('light');
    expect(mocks.setAppViewMode).toHaveBeenCalledWith('lab');
  });

  it('toggles the macOS titlebar platform preview', () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

    fireEvent.click(screen.getByRole('button', { name: 'Preview macOS titlebar' }));

    expect(mocks.toggleDevPlatformPreview).toHaveBeenCalledTimes(1);
  });

  it('toggles the simulated desktop update cache', () => {
    render(<DevMainOverlay effectiveAppViewMode="notes" />);
    expandDevelopmentTools();

    fireEvent.click(screen.getByRole('button', { name: 'Simulate update available' }));

    expect(JSON.parse(localStorage.getItem('vlaina:update:lastResult') ?? '{}')).toMatchObject({
      latestVersion: '99.99.99',
      updateAvailable: true,
      simulated: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear simulated update' }));

    expect(localStorage.getItem('vlaina:update:lastResult')).toBeNull();
  });

  it('hides the Lab shortcut while already in the Lab view', () => {
    render(<DevMainOverlay effectiveAppViewMode="lab" />);
    expandDevelopmentTools();

    expect(screen.queryByRole('button', { name: 'Open Design Lab' })).not.toBeInTheDocument();
  });
});
