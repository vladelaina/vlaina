import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/shell/AppShell';
import { SidebarUserHeader } from '@/components/layout/SidebarUserHeader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useUIStore } from '@/stores/uiSlice';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { useShortcuts } from '@/hooks/useShortcuts';
import { useSyncInit } from '@/hooks/useSyncInit';
import { useUnifiedExternalSync } from '@/hooks/useUnifiedExternalSync';
import { desktopWindow } from '@/lib/desktop/window';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { getElectronBridge, isElectronRuntime } from '@/lib/electron/bridge';
import { translate } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/appVersion';
import { useToastStore } from '@/stores/useToastStore';
import {
  type CommunitySettings,
  getCachedCommunitySettings,
  loadCommunitySettings,
} from '@/components/Settings/tabs/aboutCommunitySettings';
import { installSyncE2EBridge } from '@/lib/e2e/syncE2EBridge';

function once<T>(factory: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    promise ??= factory();
    return promise;
  };
}

const preloadSettingsModule = once(() => import('@/components/Settings'));
const preloadNotesViewModule = once(() => import('@/components/Notes/NotesView'));
const preloadChatViewModule = once(() => import('@/components/Chat/ChatView'));
const preloadNotesSidebarModule = once(() => import('@/components/Notes/features/Sidebar/NotesSidebarWrapper'));
const preloadChatSidebarModule = once(() => import('@/components/Chat/features/Sidebar/ChatSidebar'));
const preloadTemporaryChatToggleModule = once(() => import('@/components/Chat/features/Temporary/TitleBarTemporaryChatToggle'));
const preloadModelSelectorModule = once(() => import('@/components/Chat/features/Input/ModelSelector'));
const preloadNotesTabRowModule = once(() => import('@/components/Notes/features/Tabs/NotesTabRow'));
const preloadAIStoreModule = once(() => import('@/stores/useAIStore'));
const SETTINGS_PRELOAD_DELAY_MS = import.meta.env.DEV ? 120000 : 10000;
const SETTINGS_PRELOAD_IDLE_TIMEOUT_MS = 4000;
const SECONDARY_VIEW_PRELOAD_DELAY_MS = import.meta.env.DEV ? 120000 : 8000;
const SECONDARY_VIEW_PRELOAD_IDLE_TIMEOUT_MS = 3000;
const CENTER_CHROME_RENDER_DELAY_MS = 0;
const VISIBLE_SIDEBAR_RENDER_DELAY_MS = import.meta.env.DEV ? 750 : 120;
const AI_STORE_PRELOAD_DELAY_MS = import.meta.env.DEV ? 120000 : 1500;
const INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS = import.meta.env.DEV ? null : 3000;
const UPDATE_AUTO_CHECK_DELAY_MS = 2500;
const UPDATE_AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_LAST_AUTO_CHECK_KEY = 'vlaina:update:lastAutoCheckAt';

const SettingsModal = lazy(async () => {
  const mod = await preloadSettingsModule();
  return { default: mod.SettingsModal };
});

const NotesView = lazy(async () => {
  const mod = await preloadNotesViewModule();
  return { default: mod.NotesView };
});

const ChatView = lazy(async () => {
  const mod = await preloadChatViewModule();
  return { default: mod.ChatView };
});

const LabView = import.meta.env.DEV
  ? lazy(async () => {
    const mod = await import('@/components/Lab/LabView');
    return { default: mod.LabView };
  })
  : null;

const NotesSidebarWrapper = lazy(async () => {
  const mod = await preloadNotesSidebarModule();
  return { default: mod.NotesSidebarWrapper };
});

const ChatSidebar = lazy(async () => {
  const mod = await preloadChatSidebarModule();
  return { default: mod.ChatSidebar };
});

const TemporaryChatToggle = lazy(async () => {
  const mod = await preloadTemporaryChatToggleModule();
  return { default: mod.TitleBarTemporaryChatToggle };
});

const ModelSelector = lazy(async () => {
  const mod = await preloadModelSelectorModule();
  return { default: mod.ModelSelector };
});

const NotesTabRow = lazy(async () => {
  const mod = await preloadNotesTabRowModule();
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

function StartupViewFallback({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      onReady();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [onReady]);

  return (
    <div className="h-full bg-[var(--vlaina-sidebar-bg)]" />
  );
}

export function AppContent() {
  const {
    appViewMode,
    sidebarCollapsed,
    sidebarWidth,
    fontSize,
    setSidebarWidth,
    toggleSidebar,
    setAppViewMode,
    restoreLastAppViewMode,
  } = useUIStore();
  const unifiedLoaded = useUnifiedStore((state) => state.loaded);
  const lastConfiguredAppViewMode = useUnifiedStore((state) => state.data.settings.ui?.lastAppViewMode);
  const { initialize } = useVaultStore();
  const launchViewModeRef = useRef(readWindowLaunchContext().viewMode);
  const [initialUnifiedViewWaitDone, setInitialUnifiedViewWaitDone] = useState(Boolean(launchViewModeRef.current));
  const shouldWaitForInitialUnifiedView = !initialUnifiedViewWaitDone && !unifiedLoaded;
  const initialUnifiedAppViewMode =
    !launchViewModeRef.current &&
    unifiedLoaded &&
    appViewMode !== 'lab' &&
    (lastConfiguredAppViewMode === 'notes' || lastConfiguredAppViewMode === 'chat') &&
    appViewMode !== lastConfiguredAppViewMode
      ? lastConfiguredAppViewMode
      : null;
  const effectiveAppViewMode = initialUnifiedAppViewMode ?? appViewMode;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings>(() => getCachedCommunitySettings());
  const [mountedAppViews, setMountedAppViews] = useState<Set<typeof appViewMode>>(() =>
    launchViewModeRef.current ? new Set([appViewMode]) : new Set()
  );
  const [activeViewReady, setActiveViewReady] = useState(false);
  const [primaryContentReady, setPrimaryContentReady] = useState(false);
  const [shouldRenderDeferredChrome, setShouldRenderDeferredChrome] = useState(false);
  const [shouldRenderCenterChrome, setShouldRenderCenterChrome] = useState(false);
  const [renderedSidebarAppViews, setRenderedSidebarAppViews] = useState<Set<typeof appViewMode>>(() => new Set());
  const readyAppViewsRef = useRef<Set<typeof appViewMode>>(new Set());
  const primaryContentReadyAppViewsRef = useRef<Set<typeof appViewMode>>(new Set());
  const didReportStartupReadyRef = useRef(false);
  const didEnableCenterChromeRef = useRef(false);
  const didEnableDeferredChromeRef = useRef(false);
  const centerChromeTimerRef = useRef<number | null>(null);
  const deferredChromeTimerRef = useRef<number | null>(null);
  const preloadedPrimaryViewRef = useRef<typeof appViewMode | null>(null);
  const effectiveAppViewModeRef = useRef(effectiveAppViewMode);

  useEffect(() => {
    installSyncE2EBridge();
  }, []);

  useEffect(() => {
    effectiveAppViewModeRef.current = effectiveAppViewMode;
  }, [effectiveAppViewMode]);

  const reportStartupReady = useCallback(() => {
    if (didReportStartupReadyRef.current) return;
    didReportStartupReadyRef.current = true;
    getElectronBridge()?.app?.reportStartupReady?.();
  }, []);

  const handleStartupFallbackReady = useCallback(() => {
    reportStartupReady();
  }, [reportStartupReady]);

  const handleActiveViewReady = useCallback((viewMode: typeof appViewMode) => {
    readyAppViewsRef.current.add(viewMode);
    if (effectiveAppViewModeRef.current === viewMode) {
      setActiveViewReady(true);
    }
    reportStartupReady();
  }, [reportStartupReady]);

  const handlePrimaryContentReady = useCallback((viewMode: typeof appViewMode) => {
    primaryContentReadyAppViewsRef.current.add(viewMode);
    if (effectiveAppViewModeRef.current === viewMode) {
      setPrimaryContentReady(true);
    }
  }, []);

  useEffect(() => {
    if (!shouldWaitForInitialUnifiedView) return;
    if (INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setInitialUnifiedViewWaitDone(true);
    }, INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appViewMode, shouldWaitForInitialUnifiedView]);

  useEffect(() => {
    if (!unifiedLoaded) return;
    setInitialUnifiedViewWaitDone(true);
  }, [unifiedLoaded]);

  useEffect(() => {
    if (shouldWaitForInitialUnifiedView) {
      return;
    }
    const nextActiveViewReady = readyAppViewsRef.current.has(effectiveAppViewMode);
    const nextPrimaryContentReady = primaryContentReadyAppViewsRef.current.has(effectiveAppViewMode);
    const nextShouldRenderCenterChrome =
      nextActiveViewReady && (effectiveAppViewMode !== 'notes' || nextPrimaryContentReady);
    setMountedAppViews((views) => {
      if (views.has(effectiveAppViewMode)) return views;
      return new Set([...views, effectiveAppViewMode]);
    });
    setActiveViewReady(nextActiveViewReady);
    setPrimaryContentReady(nextPrimaryContentReady);
    setShouldRenderCenterChrome(nextShouldRenderCenterChrome);
    setShouldRenderDeferredChrome(false);
    didEnableCenterChromeRef.current = nextShouldRenderCenterChrome;
    didEnableDeferredChromeRef.current = false;
    if (centerChromeTimerRef.current !== null) {
      window.clearTimeout(centerChromeTimerRef.current);
      centerChromeTimerRef.current = null;
    }
    if (deferredChromeTimerRef.current !== null) {
      window.clearTimeout(deferredChromeTimerRef.current);
      deferredChromeTimerRef.current = null;
    }
  }, [appViewMode, effectiveAppViewMode, initialUnifiedAppViewMode, shouldWaitForInitialUnifiedView]);

  useEffect(() => {
    if (shouldWaitForInitialUnifiedView) return;
    if (preloadedPrimaryViewRef.current === effectiveAppViewMode) return;
    preloadedPrimaryViewRef.current = effectiveAppViewMode;

    if (effectiveAppViewMode === 'notes') {
      void preloadNotesViewModule();
      return;
    }

    if (effectiveAppViewMode === 'chat') {
      void preloadChatViewModule();
    }
  }, [effectiveAppViewMode, shouldWaitForInitialUnifiedView]);

  useEffect(() => {
    if (!activeViewReady) return;

    const enableCenterChrome = () => {
      if (effectiveAppViewMode === 'notes' && !primaryContentReady) return;
      if (didEnableCenterChromeRef.current) return;
      didEnableCenterChromeRef.current = true;
      setShouldRenderCenterChrome(true);
    };

    const enableDeferredChrome = () => {
      if (didEnableDeferredChromeRef.current) return;
      didEnableDeferredChromeRef.current = true;
      setShouldRenderDeferredChrome(true);
    };

    if (!didEnableCenterChromeRef.current) {
      centerChromeTimerRef.current = window.setTimeout(() => {
        centerChromeTimerRef.current = null;
        enableCenterChrome();
      }, CENTER_CHROME_RENDER_DELAY_MS);
    }

    if (!didEnableDeferredChromeRef.current) {
      deferredChromeTimerRef.current = window.setTimeout(() => {
        deferredChromeTimerRef.current = null;
        enableDeferredChrome();
      }, VISIBLE_SIDEBAR_RENDER_DELAY_MS);
    }

    return () => {
      if (centerChromeTimerRef.current !== null) {
        window.clearTimeout(centerChromeTimerRef.current);
        centerChromeTimerRef.current = null;
      }
      if (deferredChromeTimerRef.current !== null) {
        window.clearTimeout(deferredChromeTimerRef.current);
        deferredChromeTimerRef.current = null;
      }
    };
  }, [activeViewReady, effectiveAppViewMode, primaryContentReady]);

  useEffect(() => {
    if (!shouldRenderDeferredChrome) return;
    if (effectiveAppViewMode !== 'notes' && effectiveAppViewMode !== 'chat') return;

    setRenderedSidebarAppViews((views) => {
      if (views.has(effectiveAppViewMode)) return views;
      return new Set([...views, effectiveAppViewMode]);
    });
  }, [effectiveAppViewMode, shouldRenderDeferredChrome]);

  useEffect(() => {
    if (!activeViewReady || !primaryContentReady) return;
    if (effectiveAppViewMode !== 'notes' && effectiveAppViewMode !== 'chat') return;

    void preloadNotesViewModule();
    void preloadChatViewModule();
    void preloadNotesSidebarModule();
    void preloadChatSidebarModule();
    void preloadNotesTabRowModule();
    void preloadModelSelectorModule();

    setMountedAppViews((views) => {
      if (views.has('notes') && views.has('chat')) return views;
      return new Set([...views, 'notes', 'chat']);
    });
    setRenderedSidebarAppViews((views) => {
      if (views.has('notes') && views.has('chat')) return views;
      return new Set([...views, 'notes', 'chat']);
    });
  }, [activeViewReady, effectiveAppViewMode, primaryContentReady]);

  useEffect(() => {
    if (settingsOpen) {
      setHasOpenedSettings(true);
      void loadCommunitySettings().then(setCommunitySettings);
    }
  }, [settingsOpen]);

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
    const store = useUnifiedStore.getState();
    if (store.loaded) return;

    void store.load()
      .catch((_error) => {
        setInitialUnifiedViewWaitDone(true);
      });
  }, []);

  useEffect(() => {
    if (!activeViewReady || !primaryContentReady) return;

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
  }, [activeViewReady, primaryContentReady]);

  useEffect(() => {
    if (!activeViewReady || !primaryContentReady || !shouldRenderDeferredChrome) return;

    const preloadSecondaryView = () => {
      if (effectiveAppViewMode === 'notes') {
        void preloadChatViewModule();
        void preloadChatSidebarModule();
        void preloadTemporaryChatToggleModule();
        void preloadModelSelectorModule();
        return;
      }

      if (effectiveAppViewMode === 'chat') {
        void preloadNotesViewModule();
        void preloadNotesSidebarModule();
        void preloadNotesTabRowModule();
      }
    };

    let idleId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(preloadSecondaryView, {
          timeout: SECONDARY_VIEW_PRELOAD_IDLE_TIMEOUT_MS,
        });
        return;
      }
      preloadSecondaryView();
    }, SECONDARY_VIEW_PRELOAD_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [activeViewReady, effectiveAppViewMode, primaryContentReady, shouldRenderDeferredChrome]);

  useShortcuts();
  useSyncInit();
  useUnifiedExternalSync();

  useEffect(() => {
    if (!activeViewReady || !primaryContentReady || !shouldRenderDeferredChrome) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void preloadAIStoreModule()
        .then((mod) => {
          if (cancelled) return;
          mod.startAIStoreRuntimeEffects?.();
        })
        .catch((_error) => {
        });
    }, AI_STORE_PRELOAD_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeViewReady, primaryContentReady, shouldRenderDeferredChrome]);

  useEffect(() => {
    void Promise.resolve(initialize())
      .catch((_error) => {
      });
  }, [initialize]);

  useEffect(() => {
    if (!unifiedLoaded) return;
    if (launchViewModeRef.current) return;
    if (lastConfiguredAppViewMode !== 'notes' && lastConfiguredAppViewMode !== 'chat') return;
    restoreLastAppViewMode(lastConfiguredAppViewMode);
  }, [lastConfiguredAppViewMode, restoreLastAppViewMode, unifiedLoaded]);

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
            translate('settings.about.updateToastAvailable', { version: updateInfo.latestVersion || APP_VERSION }),
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
    if (effectiveAppViewMode === 'chat' || typeof document === 'undefined') return;
    document.body.removeAttribute('data-chat-selection-lock');
  }, [effectiveAppViewMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('spellcheck', 'false');
    document.body.setAttribute('spellcheck', 'false');
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.removeProperty('font-size');
    document.documentElement.style.setProperty('--vlaina-markdown-font-size', `${fontSize}px`);
  }, [fontSize]);

  useEffect(() => {
    if (!isElectronRuntime()) return;

    const unlockWindow = async () => {
      await desktopWindow.setResizable(true);
      await desktopWindow.setMaximizable(true);
      await desktopWindow.setMinSize({ width: 800, height: 600 });
      const size = await desktopWindow.getSize();
      if (size.width < 800 || size.height < 600) {
        await desktopWindow.setSize({
          width: Math.max(800, size.width),
          height: Math.max(600, size.height),
        });
        await desktopWindow.center();
      }
    };
    void unlockWindow();
  }, []);

  const shouldRenderSidebar = effectiveAppViewMode === 'chat' || effectiveAppViewMode === 'notes';
  const shouldMountNotes = mountedAppViews.has('notes');
  const shouldMountChat = mountedAppViews.has('chat');
  const shouldRenderNotesSidebar = renderedSidebarAppViews.has('notes');
  const shouldRenderChatSidebar = renderedSidebarAppViews.has('chat');
  const shouldShowNotesSidebar = effectiveAppViewMode === 'notes';
  const shouldShowChatSidebar = effectiveAppViewMode === 'chat';

  const sidebarContent = shouldRenderSidebar ? (
    <div className="grid h-full min-h-0">
      {shouldRenderChatSidebar ? (
        <div
          className={cn(
            'col-start-1 row-start-1 h-full min-h-0',
            !shouldShowChatSidebar && 'pointer-events-none invisible',
          )}
          aria-hidden={!shouldShowChatSidebar}
        >
          <Suspense fallback={null}>
            <ChatSidebar isPeeking={false} active={shouldShowChatSidebar} />
          </Suspense>
        </div>
      ) : null}
      {shouldRenderNotesSidebar ? (
        <div
          className={cn(
            'col-start-1 row-start-1 h-full min-h-0',
            !shouldShowNotesSidebar && 'pointer-events-none invisible',
          )}
          aria-hidden={!shouldShowNotesSidebar}
        >
          <Suspense fallback={null}>
            <NotesSidebarWrapper isPeeking={false} active={shouldShowNotesSidebar} />
          </Suspense>
        </div>
      ) : null}
    </div>
  ) : null;

  const centerSlot = !shouldRenderCenterChrome ? null : effectiveAppViewMode === 'notes' ? (
    <Suspense fallback={null}>
      <NotesTabRow />
    </Suspense>
  ) : effectiveAppViewMode === 'chat' ? (
    <Suspense fallback={null}>
      <div className="flex h-full items-center pl-2">
        <ModelSelector dropdownPlacement="bottom" dropdownAlign="left" />
      </div>
    </Suspense>
  ) : null;

  const rightSlot = shouldRenderDeferredChrome && effectiveAppViewMode === 'chat' ? (
    <Suspense fallback={null}>
      <TemporaryChatToggle />
    </Suspense>
  ) : null;

  const mainContent = shouldWaitForInitialUnifiedView ? (
    <StartupViewFallback onReady={handleStartupFallbackReady} />
  ) : import.meta.env.DEV && effectiveAppViewMode === 'lab' && LabView ? (
    <Suspense fallback={null}>
      <LabView />
    </Suspense>
  ) : (
    <>
      {shouldMountNotes ? (
        <div className={cn('h-full', effectiveAppViewMode !== 'notes' && 'hidden')} aria-hidden={effectiveAppViewMode !== 'notes'}>
          <Suspense fallback={<StartupViewFallback onReady={handleStartupFallbackReady} />}>
            <NotesView
              active={effectiveAppViewMode === 'notes'}
              onStartupReady={() => handleActiveViewReady('notes')}
              onPrimaryContentReady={() => handlePrimaryContentReady('notes')}
            />
          </Suspense>
        </div>
      ) : null}
      {shouldMountChat ? (
        <div className={cn('h-full', effectiveAppViewMode !== 'chat' && 'hidden')} aria-hidden={effectiveAppViewMode !== 'chat'}>
          <Suspense fallback={<StartupViewFallback onReady={handleStartupFallbackReady} />}>
            <ChatView
              active={effectiveAppViewMode === 'chat'}
              onStartupReady={() => handleActiveViewReady('chat')}
              onPrimaryContentReady={() => handlePrimaryContentReady('chat')}
            />
          </Suspense>
        </div>
      ) : null}
    </>
  );

  const showLabEntry = import.meta.env.DEV && effectiveAppViewMode !== 'lab';
  const mainOverlay = showLabEntry ? (
    <div className="pointer-events-none absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2">
      <Tooltip delayDuration={700}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setAppViewMode('lab')}
            aria-label="Open Design Lab"
            className={cn(
              'pointer-events-auto flex h-8 w-8 items-center justify-center rounded-md border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--vlaina-hover)]',
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
    </div>
  ) : null;

  return (
    <>
      <Suspense fallback={null}>
        {hasOpenedSettings ? (
          <SettingsModal
            open={settingsOpen}
            communitySettings={communitySettings}
            onClose={() => setSettingsOpen(false)}
          />
        ) : null}
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
        titleBarCenterOverflowVisible={effectiveAppViewMode === 'chat'}
        mainOverlay={mainOverlay}
        backgroundColor="var(--vlaina-sidebar-bg)"
      >
        {mainContent}
      </AppShell>
    </>
  );
}
