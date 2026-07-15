import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContent } from './AppContent';
import { MARKDOWN_FONT_SIZE_STYLE_ID } from '@/lib/markdown/markdownFontSize';

type AppViewMode = 'notes' | 'chat' | 'whiteboard' | 'lab';

const mocks = vi.hoisted(() => ({
  appViewMode: 'notes' as AppViewMode,
  setAppViewMode: vi.fn(),
  restoreLastAppViewMode: vi.fn(),
  restoreNotesChatFloatingSize: vi.fn(),
  initializeNotesRoot: vi.fn(),
  loadUnified: vi.fn().mockResolvedValue(undefined),
  colorMode: 'system' as 'system' | 'light' | 'dark',
  importedMarkdownThemeId: null as string | null,
  notesChatFloatingSize: { width: 420, height: 680 },
  setColorMode: vi.fn(),
  setMarkdownImportedThemeId: vi.fn(),
  listImportedMarkdownThemesFromDirectory: vi.fn(),
  syncImportedMarkdownThemesFromDirectory: vi.fn(),
  startAIStoreRuntimeEffects: vi.fn(),
  prewarmManagedStartupDataInBackground: vi.fn(),
  unifiedLoaded: true,
  settingsModuleImports: 0,
  temporaryChatToggleModuleImports: 0,
  fontSize: 17,
  notesSidebarMounts: 0,
  notesSidebarUnmounts: 0,
  whiteboardMounts: 0,
  whiteboardSidebarMounts: 0,
}));

vi.mock('@/components/layout/shell/AppShell', () => ({
  AppShell: ({
    children,
    sidebarContent,
    titleBarCenter,
    titleBarRight,
    mainOverlay,
  }: {
    children: React.ReactNode;
    sidebarContent?: React.ReactNode;
    titleBarCenter?: React.ReactNode;
    titleBarRight?: React.ReactNode;
    mainOverlay?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="titlebar-center">{titleBarCenter}</div>
      <div data-testid="titlebar-right">{titleBarRight}</div>
      <aside data-testid="sidebar">{sidebarContent}</aside>
      <main>{children}</main>
      <div data-testid="main-overlay">{mainOverlay}</div>
    </div>
  ),
}));

vi.mock('@/components/layout/SidebarUserHeader', () => ({
  SidebarUserHeader: () => <div data-testid="sidebar-user-header" />,
}));

vi.mock('@/components/Notes/NotesView', () => {
  return {
    NotesView: ({
      active,
      onStartupReady,
      onPrimaryContentReady,
    }: {
      active?: boolean;
      onStartupReady?: () => void;
      onPrimaryContentReady?: () => void;
    }) => {
      React.useEffect(() => {
        onStartupReady?.();
        onPrimaryContentReady?.();
      }, [onPrimaryContentReady, onStartupReady]);

      return <div data-testid="notes-view" data-active={String(active)} />;
    },
  };
});

vi.mock('@/components/Chat/ChatView', () => ({
  ChatView: ({
    active,
    onStartupReady,
    onPrimaryContentReady,
  }: {
    active?: boolean;
    onStartupReady?: () => void;
    onPrimaryContentReady?: () => void;
  }) => {
    React.useEffect(() => {
      if (!active) return;
      onStartupReady?.();
      onPrimaryContentReady?.();
    }, [active, onPrimaryContentReady, onStartupReady]);

    return <div data-testid="chat-view" data-active={String(active)} />;
  },
}));

vi.mock('@/components/Whiteboard', () => ({
  WhiteboardView: ({
    active,
    onStartupReady,
    onPrimaryContentReady,
  }: {
    active?: boolean;
    onStartupReady?: () => void;
    onPrimaryContentReady?: () => void;
  }) => {
    React.useEffect(() => {
      mocks.whiteboardMounts += 1;
    }, []);

    React.useEffect(() => {
      onStartupReady?.();
      onPrimaryContentReady?.();
    }, [onPrimaryContentReady, onStartupReady]);

    return <div data-testid="whiteboard-view" data-active={String(active)} />;
  },
  WhiteboardSidebar: () => {
    React.useEffect(() => {
      mocks.whiteboardSidebarMounts += 1;
    }, []);

    return <div data-testid="whiteboard-sidebar" />;
  },
}));

vi.mock('@/components/Notes/features/Sidebar/NotesSidebarWrapper', () => ({
  NotesSidebarWrapper: ({ active }: { active?: boolean }) => {
    React.useEffect(() => {
      mocks.notesSidebarMounts += 1;
      return () => {
        mocks.notesSidebarUnmounts += 1;
      };
    }, []);

    return <div data-testid="notes-sidebar" data-active={String(active)} />;
  },
}));

vi.mock('@/components/Chat/features/Sidebar/ChatSidebar', () => ({
  ChatSidebar: ({ active }: { active?: boolean }) => (
    <div data-testid="chat-sidebar" data-active={String(active)} />
  ),
}));

vi.mock('@/components/Notes/features/Tabs/NotesTabRow', () => ({
  NotesTabRow: () => <div data-testid="notes-tab-row" />,
}));

vi.mock('@/components/Chat/features/Input/ModelSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock('@/components/Chat/features/Temporary/TitleBarTemporaryChatToggle', () => {
  mocks.temporaryChatToggleModuleImports += 1;
  return {
    TitleBarTemporaryChatToggle: () => <div data-testid="temporary-chat-toggle" />,
  };
});

vi.mock('@/components/Settings', () => {
  mocks.settingsModuleImports += 1;
  return {
    SettingsModal: () => null,
  };
});

vi.mock('@/components/Settings/tabs/aboutCommunitySettings', () => ({
  getCachedCommunitySettings: vi.fn(() => ({
    qqGroupNumber: '',
    qqQrCodeText: '',
    wechatQrCodeText: '',
  })),
  loadCommunitySettings: vi.fn(() => Promise.resolve({
    qqGroupNumber: '',
    qqQrCodeText: '',
    wechatQrCodeText: '',
  })),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/icons', () => ({
  Icon: () => <span />,
}));

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils');
  return {
    ...actual,
    iconButtonStyles: '',
  };
});

vi.mock('@/stores/uiSlice', () => ({
  useUIStore: (selector: (state: {
    appViewMode: AppViewMode;
    sidebarCollapsed: boolean;
    sidebarWidth: number;
    fontSize: number;
    setSidebarWidth: () => void;
    toggleSidebar: () => void;
    setAppViewMode: typeof mocks.setAppViewMode;
    restoreLastAppViewMode: typeof mocks.restoreLastAppViewMode;
    restoreNotesChatFloatingSize: typeof mocks.restoreNotesChatFloatingSize;
  }) => unknown) => selector({
    appViewMode: mocks.appViewMode,
    sidebarCollapsed: false,
    sidebarWidth: 320,
    fontSize: mocks.fontSize,
    setSidebarWidth: vi.fn(),
    toggleSidebar: vi.fn(),
    setAppViewMode: mocks.setAppViewMode,
    restoreLastAppViewMode: mocks.restoreLastAppViewMode,
    restoreNotesChatFloatingSize: mocks.restoreNotesChatFloatingSize,
  }),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => {
  type UnifiedState = {
    loaded: boolean;
    data: {
      settings: {
        ui: {
          lastAppViewMode: 'notes' | 'chat';
          colorMode: 'system' | 'light' | 'dark';
          notesChatFloatingSize: { width: number; height: number };
        };
        markdown: {
          theme: {
            importedThemeId: string | null;
          };
        };
      };
    };
    load: typeof mocks.loadUnified;
    setColorMode: typeof mocks.setColorMode;
    setMarkdownImportedThemeId: typeof mocks.setMarkdownImportedThemeId;
  };

  const getState = (): UnifiedState => ({
    loaded: mocks.unifiedLoaded,
    data: {
      settings: {
        ui: {
          lastAppViewMode: mocks.appViewMode === 'chat' ? 'chat' : 'notes',
          colorMode: mocks.colorMode,
          notesChatFloatingSize: mocks.notesChatFloatingSize,
        },
        markdown: {
          theme: {
            importedThemeId: mocks.importedMarkdownThemeId,
          },
        },
      },
    },
    load: mocks.loadUnified,
    setColorMode: mocks.setColorMode,
    setMarkdownImportedThemeId: mocks.setMarkdownImportedThemeId,
  });

  const useUnifiedStore = (selector: (state: UnifiedState) => unknown) => selector(getState());
  useUnifiedStore.getState = getState;

  return { useUnifiedStore };
});

vi.mock('@/stores/useNotesRootStore', () => ({
  useNotesRootStore: (selector: (state: { initialize: typeof mocks.initializeNotesRoot }) => unknown) =>
    selector({ initialize: mocks.initializeNotesRoot }),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

vi.mock('@/hooks/useShortcuts', () => ({ useShortcuts: vi.fn() }));
vi.mock('@/hooks/useSyncInit', () => ({ useSyncInit: vi.fn() }));
vi.mock('@/hooks/useUnifiedExternalSync', () => ({ useUnifiedExternalSync: vi.fn() }));

vi.mock('@/lib/desktop/window', () => ({
  desktopWindow: {
    setResizable: vi.fn().mockResolvedValue(undefined),
    setMaximizable: vi.fn().mockResolvedValue(undefined),
    setMinSize: vi.fn().mockResolvedValue(undefined),
    getSize: vi.fn().mockResolvedValue({ width: 1280, height: 720 }),
    setSize: vi.fn().mockResolvedValue(undefined),
    center: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/desktop/launchContext', () => ({
  readWindowLaunchContext: () => ({ viewMode: null, folderPath: null, notePath: null }),
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => ({ app: { reportStartupReady: vi.fn() } }),
  isElectronRuntime: () => false,
}));

vi.mock('@/lib/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/lib/appVersion', () => ({
  APP_VERSION: '0.0.0-test',
}));

vi.mock('@/stores/useAIStore', () => ({
  startAIStoreRuntimeEffects: mocks.startAIStoreRuntimeEffects,
  actions: {
    prewarmManagedStartupDataInBackground: mocks.prewarmManagedStartupDataInBackground,
  },
}));

vi.mock('@/lib/markdown/theme-compatibility/importedThemeStorage', () => ({
  listImportedMarkdownThemesFromDirectory: (...args: unknown[]) =>
    mocks.listImportedMarkdownThemesFromDirectory(...args),
  syncImportedMarkdownThemesFromDirectory: (...args: unknown[]) =>
    mocks.syncImportedMarkdownThemesFromDirectory(...args),
}));

const importedTheme = {
  id: 'vlook-fancy',
  name: 'vlook-fancy',
  platform: 'typora' as const,
  cssFile: 'vlook-fancy.css',
  sourcePath: '/app/.vlaina/app/themes/vlook-fancy.css',
  sourceModifiedAt: 10,
  sourceSize: 100,
  createdAt: 1,
  updatedAt: 2,
};

describe('AppContent view switching chrome readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appViewMode = 'notes';
    mocks.colorMode = 'system';
    mocks.importedMarkdownThemeId = null;
    mocks.notesChatFloatingSize = { width: 420, height: 680 };
    mocks.fontSize = 17;
    mocks.settingsModuleImports = 0;
    mocks.temporaryChatToggleModuleImports = 0;
    mocks.notesSidebarMounts = 0;
    mocks.notesSidebarUnmounts = 0;
    mocks.whiteboardMounts = 0;
    mocks.whiteboardSidebarMounts = 0;
    mocks.unifiedLoaded = true;
    mocks.listImportedMarkdownThemesFromDirectory.mockResolvedValue([importedTheme]);
    mocks.syncImportedMarkdownThemesFromDirectory.mockResolvedValue({
      directoryPath: '/app/.vlaina/app/themes',
      themes: [importedTheme],
      activeThemeId: 'vlook-fancy',
    });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.style.removeProperty('--vlaina-markdown-font-size');
    document.getElementById(MARKDOWN_FONT_SIZE_STYLE_ID)?.remove();
  });

  it('preloads the settings module after unified data is loaded', async () => {
    render(<AppContent />);

    await waitFor(() => {
      expect(mocks.settingsModuleImports).toBeGreaterThanOrEqual(1);
    });
    await waitFor(() => {
      expect(mocks.temporaryChatToggleModuleImports).toBeGreaterThanOrEqual(1);
    });
  });

  it('prewarms managed models and account entitlements after the initial notes view is ready', async () => {
    render(<AppContent />);

    expect(await screen.findByTestId('chat-view', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    await waitFor(() => {
      expect(mocks.prewarmManagedStartupDataInBackground).toHaveBeenCalledWith();
    });
    expect(mocks.prewarmManagedStartupDataInBackground).toHaveBeenCalledTimes(1);
  });

  it('waits for unified data before prewarming managed startup data', async () => {
    mocks.unifiedLoaded = false;
    const { rerender } = render(<AppContent />);

    expect(mocks.prewarmManagedStartupDataInBackground).not.toHaveBeenCalled();

    mocks.unifiedLoaded = true;
    rerender(<AppContent />);

    expect(await screen.findByTestId('chat-view', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    await waitFor(() => {
      expect(mocks.prewarmManagedStartupDataInBackground).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the notes sidebar mounted when switching away and back to an already ready notes view', async () => {
    const { rerender } = render(<AppContent />);

    expect(await screen.findByTestId('notes-sidebar', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('notes-sidebar')).toHaveAttribute('data-active', 'true');
    expect(await screen.findByTestId('chat-sidebar', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(await screen.findByTestId('chat-view', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(await screen.findByTestId('notes-tab-row', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(mocks.notesSidebarMounts).toBe(1);

    mocks.appViewMode = 'chat';
    rerender(<AppContent />);

    expect(await screen.findByTestId('chat-sidebar', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByTestId('chat-sidebar')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('chat-view')).toHaveAttribute('data-active', 'true');
    expect(await screen.findByTestId('model-selector', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(mocks.notesSidebarUnmounts).toBe(0);

    mocks.appViewMode = 'notes';
    rerender(<AppContent />);

    await waitFor(() => {
      expect(screen.getByTestId('notes-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('notes-tab-row')).toBeInTheDocument();
    });
    expect(screen.getByTestId('notes-sidebar')).toHaveAttribute('data-active', 'true');
    expect(mocks.notesSidebarMounts).toBe(1);
    expect(mocks.notesSidebarUnmounts).toBe(0);
  });

  it('prewarms notes sidebar and view while chat is the initial active view', async () => {
    mocks.appViewMode = 'chat';
    const { rerender } = render(<AppContent />);

    expect(await screen.findByTestId('chat-sidebar', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'true');
    expect(await screen.findByTestId('notes-sidebar', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(await screen.findByTestId('notes-view', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(mocks.notesSidebarMounts).toBe(1);

    mocks.appViewMode = 'notes';
    rerender(<AppContent />);

    expect(screen.getByTestId('notes-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('notes-sidebar')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('notes-view')).toHaveAttribute('data-active', 'true');
    expect(mocks.notesSidebarMounts).toBe(1);
  });

  it('prewarms the whiteboard view and sidebar after the initial notes view is ready', async () => {
    const { rerender } = render(<AppContent />);

    expect(await screen.findByTestId('whiteboard-view', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(await screen.findByTestId('whiteboard-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('whiteboard-sidebar').parentElement).toHaveClass('hidden');
    expect(mocks.whiteboardMounts).toBe(1);
    expect(mocks.whiteboardSidebarMounts).toBe(1);

    mocks.appViewMode = 'whiteboard';
    rerender(<AppContent />);

    await waitFor(() => {
      expect(screen.getByTestId('whiteboard-view')).toHaveAttribute('data-active', 'true');
    });
    expect(screen.getByTestId('whiteboard-sidebar').parentElement).not.toHaveClass('hidden');
    expect(mocks.whiteboardMounts).toBe(1);
    expect(mocks.whiteboardSidebarMounts).toBe(1);
  });

  it('keeps inactive prewarmed sidebars mounted but out of layout', async () => {
    const { rerender } = render(<AppContent />);

    expect(await screen.findByTestId('chat-sidebar', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('chat-sidebar').parentElement).toHaveClass('hidden');

    mocks.appViewMode = 'chat';
    rerender(<AppContent />);

    expect(await screen.findByTestId('notes-sidebar', undefined, { timeout: 3000 })).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('notes-sidebar').parentElement).toHaveClass('hidden');
  });

  it('scopes the appearance font size to markdown content surfaces', async () => {
    document.documentElement.style.fontSize = '17px';
    mocks.fontSize = 17;

    render(<AppContent />);

    await waitFor(() => {
      expect(document.getElementById(MARKDOWN_FONT_SIZE_STYLE_ID)?.textContent).toContain(
        '--vlaina-markdown-font-size: 17px',
      );
    });
    expect(document.documentElement.style.fontSize).toBe('');
    expect(document.documentElement.style.getPropertyValue('--vlaina-markdown-font-size')).toBe('');
  });

  it('starts AI runtime effects after unified data is loaded', async () => {
    render(<AppContent />);

    await waitFor(() => {
      expect(mocks.startAIStoreRuntimeEffects).toHaveBeenCalledTimes(1);
    });
  });

  it('cycles imported markdown themes from the dev-only main overlay', async () => {
    render(<AppContent />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Expand development tools',
    }));

    fireEvent.click(await screen.findByRole('button', {
      name: 'Switch Markdown theme (default)',
    }));

    await waitFor(() => {
      expect(mocks.setMarkdownImportedThemeId).toHaveBeenCalledWith('vlook-fancy');
    });
    expect(mocks.listImportedMarkdownThemesFromDirectory).toHaveBeenCalledTimes(1);
  });
});
