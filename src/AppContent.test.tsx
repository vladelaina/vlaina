import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppContent } from './AppContent';

type AppViewMode = 'notes' | 'chat' | 'lab';

const mocks = vi.hoisted(() => ({
  appViewMode: 'notes' as AppViewMode,
  setAppViewMode: vi.fn(),
  restoreLastAppViewMode: vi.fn(),
  initializeVault: vi.fn(),
  loadUnified: vi.fn().mockResolvedValue(undefined),
  startAIStoreRuntimeEffects: vi.fn(),
  notesSidebarMounts: 0,
  notesSidebarUnmounts: 0,
}));

vi.mock('@/components/layout/shell/AppShell', () => ({
  AppShell: ({
    children,
    sidebarContent,
    titleBarCenter,
    titleBarRight,
  }: {
    children: React.ReactNode;
    sidebarContent?: React.ReactNode;
    titleBarCenter?: React.ReactNode;
    titleBarRight?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="titlebar-center">{titleBarCenter}</div>
      <div data-testid="titlebar-right">{titleBarRight}</div>
      <aside data-testid="sidebar">{sidebarContent}</aside>
      <main>{children}</main>
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

vi.mock('@/components/Chat/features/Temporary/TitleBarTemporaryChatToggle', () => ({
  TitleBarTemporaryChatToggle: () => <div data-testid="temporary-chat-toggle" />,
}));

vi.mock('@/components/Settings', () => ({
  SettingsModal: () => null,
}));

vi.mock('@/components/Settings/tabs/aboutCommunitySettings', () => ({
  loadCommunitySettings: vi.fn(),
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
  useUIStore: () => ({
    appViewMode: mocks.appViewMode,
    sidebarCollapsed: false,
    sidebarWidth: 320,
    fontSize: 16,
    setSidebarWidth: vi.fn(),
    toggleSidebar: vi.fn(),
    setAppViewMode: mocks.setAppViewMode,
    restoreLastAppViewMode: mocks.restoreLastAppViewMode,
  }),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => {
  type UnifiedState = {
    loaded: boolean;
    data: {
      settings: {
        ui: {
          lastAppViewMode: 'notes' | 'chat';
        };
      };
    };
    load: typeof mocks.loadUnified;
  };

  const getState = (): UnifiedState => ({
    loaded: true,
    data: {
      settings: {
        ui: {
          lastAppViewMode: mocks.appViewMode === 'chat' ? 'chat' : 'notes',
        },
      },
    },
    load: mocks.loadUnified,
  });

  const useUnifiedStore = (selector: (state: UnifiedState) => unknown) => selector(getState());
  useUnifiedStore.getState = getState;

  return { useUnifiedStore };
});

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: () => ({ initialize: mocks.initializeVault }),
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
}));

describe('AppContent view switching chrome readiness', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.appViewMode = 'notes';
    mocks.notesSidebarMounts = 0;
    mocks.notesSidebarUnmounts = 0;
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
});
