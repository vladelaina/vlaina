import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useAIStoreRuntimeEffects } from '@/stores/useAIStore';
import { useUIStore } from '@/stores/uiSlice';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useUnifiedExternalSync } from '@/hooks/useUnifiedExternalSync';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';
import { desktopWindow } from '@/lib/desktop/window';
import { getElectronBridge, isElectronRuntime } from '@/lib/electron/bridge';
import { writeTextToClipboard } from '@/lib/clipboard';
import { getConsoleLogText, installConsoleLogCapture } from '@/lib/consoleLogBuffer';
import { useToastStore } from '@/stores/useToastStore';

const preloadSettingsModule = () => import('@/components/Settings');
const SETTINGS_PRELOAD_DELAY_MS = 8000;
const SETTINGS_PRELOAD_IDLE_TIMEOUT_MS = 4000;
const UPDATE_AUTO_CHECK_DELAY_MS = 2500;
const UPDATE_AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_LAST_AUTO_CHECK_KEY = 'vlaina:update:lastAutoCheckAt';

const SettingsModal = lazy(async () => {
  const mod = await preloadSettingsModule();
  return { default: mod.SettingsModal };
});

const NotesView = lazy(async () => {
  const mod = await import('@/components/Notes/NotesView');
  return { default: mod.NotesView };
});

const ChatView = lazy(async () => {
  const mod = await import('@/components/Chat/ChatView');
  return { default: mod.ChatView };
});

const LabView = import.meta.env.DEV
  ? lazy(async () => {
    const mod = await import('@/components/Lab/LabView');
    return { default: mod.LabView };
  })
  : null;

const NotesSidebarWrapper = lazy(async () => {
  const mod = await import('@/components/Notes/features/Sidebar/NotesSidebarWrapper');
  return { default: mod.NotesSidebarWrapper };
});

const ChatSidebar = lazy(async () => {
  const mod = await import('@/components/Chat/features/Sidebar/ChatSidebar');
  return { default: mod.ChatSidebar };
});

const TemporaryChatToggle = lazy(async () => {
  const mod = await import('@/components/Chat/features/Temporary/TemporaryChatToggle');
  return { default: mod.TemporaryChatToggle };
});

const ModelSelector = lazy(async () => {
  const mod = await import('@/components/Chat/features/Input/ModelSelector');
  return { default: mod.ModelSelector };
});

const NotesTabRow = lazy(async () => {
  const mod = await import('@/components/Notes/features/Tabs/NotesTabRow');
  return { default: mod.NotesTabRow };
});

function readStoredTimestamp(key: string) {
  try {
    const value = Number.parseInt(window.localStorage.getItem(key) ?? '', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeStoredTimestamp(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Update checks are best effort; storage failures should not affect startup.
  }
}

export function AppContent() {
  useAIStoreRuntimeEffects();

  const {
    appViewMode,
    sidebarCollapsed,
    sidebarWidth,
    fontSize,
    setSidebarWidth,
    toggleSidebar,
    setAppViewMode,
  } = useUIStore();
  const { initialize } = useVaultStore();
  const { showInTitleBar } = useTemporaryTogglePresentation();
  const shouldShowTemporaryToggleInTitleBar =
    showInTitleBar &&
    appViewMode === 'chat';

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [consoleCopyState, setConsoleCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const consoleCopyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOpenSettings = () => setSettingsOpen(true);
    const handleToggleSettings = () => setSettingsOpen((open) => !open);
    window.addEventListener('open-settings', handleOpenSettings);
    window.addEventListener('toggle-settings', handleToggleSettings);
    return () => {
      window.removeEventListener('open-settings', handleOpenSettings);
      window.removeEventListener('toggle-settings', handleToggleSettings);
    };
  }, []);

  useEffect(() => {
    installConsoleLogCapture();
  }, []);

  useEffect(() => {
    const preload = () => {
      void preloadSettingsModule();
    };

    let idleId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(preload, { timeout: SETTINGS_PRELOAD_IDLE_TIMEOUT_MS });
        return;
      }
      preload();
    }, SETTINGS_PRELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  useShortcuts();
  useSyncInit();
  useUnifiedExternalSync();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (import.meta.env.DEV) return;

    const bridge = getElectronBridge();
    if (!bridge?.update) return;

    const lastCheckedAt = readStoredTimestamp(UPDATE_LAST_AUTO_CHECK_KEY);
    if (lastCheckedAt > 0 && Date.now() - lastCheckedAt < UPDATE_AUTO_CHECK_INTERVAL_MS) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void bridge.update?.check()
        .then((updateInfo) => {
          if (cancelled || !updateInfo.updateAvailable) return;
          useToastStore.getState().addToast(
            `vlaina ${updateInfo.latestVersion} is available. Open Settings > About to download.`,
            'info',
            8000,
          );
        })
        .catch(() => {
        })
        .finally(() => {
          if (!cancelled) {
            writeStoredTimestamp(UPDATE_LAST_AUTO_CHECK_KEY, Date.now());
          }
        });
    }, UPDATE_AUTO_CHECK_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (appViewMode === 'chat' || typeof document === 'undefined') return;
    document.body.removeAttribute('data-chat-selection-lock');
  }, [appViewMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  useEffect(() => {
    if (!isElectronRuntime()) return;

    const unlockWindow = async () => {
      await desktopWindow.setResizable(true);
      await desktopWindow.setMaximizable(true);
      await desktopWindow.setMinSize({ width: 800, height: 600 });
      const size = await desktopWindow.getSize();
      if (size.width < 980 || size.height < 640) {
        await desktopWindow.setSize({ width: 980, height: 640 });
        await desktopWindow.center();
      }
    };
    void unlockWindow();
  }, []);

  useEffect(() => {
    return () => {
      if (consoleCopyTimerRef.current !== null) {
        window.clearTimeout(consoleCopyTimerRef.current);
      }
    };
  }, []);

  const handleCopyConsoleLog = useCallback(() => {
    if (consoleCopyTimerRef.current !== null) {
      window.clearTimeout(consoleCopyTimerRef.current);
    }

    const consoleLogText = getConsoleLogText() || '[Console] No logs captured.';

    void writeTextToClipboard(consoleLogText)
      .then((didCopy) => {
        setConsoleCopyState(didCopy ? 'copied' : 'failed');
      })
      .catch(() => {
        setConsoleCopyState('failed');
      })
      .finally(() => {
        consoleCopyTimerRef.current = window.setTimeout(() => {
          setConsoleCopyState('idle');
          consoleCopyTimerRef.current = null;
        }, 1200);
      });
  }, []);

  const shouldRenderSidebar = appViewMode === 'chat' || appViewMode === 'notes';

  const sidebarContent = shouldRenderSidebar ? (
    <div className="grid h-full min-h-0">
      <div
        className={cn(
          'col-start-1 row-start-1 h-full min-h-0',
          appViewMode !== 'chat' && 'pointer-events-none invisible',
        )}
        aria-hidden={appViewMode !== 'chat'}
      >
        <Suspense fallback={null}>
          <ChatSidebar isPeeking={false} />
        </Suspense>
      </div>
      <div
        className={cn(
          'col-start-1 row-start-1 h-full min-h-0',
          appViewMode !== 'notes' && 'pointer-events-none invisible',
        )}
        aria-hidden={appViewMode !== 'notes'}
      >
        <Suspense fallback={null}>
          <NotesSidebarWrapper isPeeking={false} />
        </Suspense>
      </div>
    </div>
  ) : null;

  const centerSlot = appViewMode === 'notes' ? (
    <Suspense fallback={null}>
      <NotesTabRow />
    </Suspense>
  ) : appViewMode === 'chat' ? (
    <Suspense fallback={null}>
      <div className="flex h-full translate-y-0.5 items-center pl-2">
        <ModelSelector dropdownPlacement="bottom" dropdownAlign="left" />
      </div>
    </Suspense>
  ) : null;

  const rightSlot = shouldShowTemporaryToggleInTitleBar ? (
    <Suspense fallback={null}>
      <TemporaryChatToggle mode="promote" />
    </Suspense>
  ) : null;

  const mainContent = import.meta.env.DEV && appViewMode === 'lab' && LabView ? (
    <Suspense fallback={null}>
      <LabView />
    </Suspense>
  ) : (
    <>
      <div className={cn('h-full', appViewMode !== 'notes' && 'hidden')} aria-hidden={appViewMode !== 'notes'}>
        <Suspense fallback={null}>
          <NotesView active={appViewMode === 'notes'} />
        </Suspense>
      </div>
      <div className={cn('h-full', appViewMode !== 'chat' && 'hidden')} aria-hidden={appViewMode !== 'chat'}>
        <Suspense fallback={null}>
          <ChatView active={appViewMode === 'chat'} />
        </Suspense>
      </div>
    </>
  );

  const showLabEntry = import.meta.env.DEV && appViewMode !== 'lab';
  const showConsoleCopy = import.meta.env.DEV;
  const mainOverlay = showLabEntry || showConsoleCopy ? (
    <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2">
      {showConsoleCopy ? (
        <Tooltip delayDuration={700}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopyConsoleLog}
              aria-label="Copy Console Logs"
              className={cn(
                'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[#eff3f4] bg-white/92 shadow-sm backdrop-blur-sm transition-[background-color,box-shadow,transform,border-color] duration-200 hover:bg-[#f5f5f5]',
                iconButtonStyles,
                consoleCopyState === 'copied' && 'scale-110 border-emerald-300 text-emerald-600 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]',
                consoleCopyState === 'failed' && 'scale-105 border-red-300 text-red-600 shadow-[0_0_0_3px_rgba(239,68,68,0.16)]',
              )}
            >
              <Icon name={consoleCopyState === 'copied' ? 'common.check' : 'common.copy'} size="md" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            <span className="text-xs">
              {consoleCopyState === 'copied'
                ? 'Copied Console Logs'
                : consoleCopyState === 'failed'
                  ? 'Copy Failed'
                  : 'Copy Console Logs'}
            </span>
          </TooltipContent>
        </Tooltip>
      ) : null}

      {showLabEntry ? (
        <Tooltip delayDuration={700}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setAppViewMode('lab')}
              aria-label="Open Design Lab"
              className={cn(
                'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[#eff3f4] bg-white/92 shadow-sm backdrop-blur-sm transition-colors hover:bg-[#f5f5f5]',
                iconButtonStyles
              )}
            >
              <Icon name="misc.lab" size="md" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            <span className="text-xs">Open Design Lab</span>
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <Suspense fallback={null}>
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Suspense>

      <AppShell
        sidebarWidth={sidebarWidth}
        sidebarCollapsed={sidebarCollapsed}
        onSidebarWidthChange={setSidebarWidth}
        onSidebarToggle={toggleSidebar}
        sidebarContent={sidebarContent}
        titleBarLeft={
          <SidebarUserHeader toggleSidebar={toggleSidebar} />
        }
        titleBarCenter={centerSlot}
        titleBarRight={rightSlot}
        titleBarCenterOverflowVisible={appViewMode === 'chat'}
        mainOverlay={mainOverlay}
        backgroundColor="var(--vlaina-sidebar-bg)"
      >
        {mainContent}
      </AppShell>
    </>
  );
}
