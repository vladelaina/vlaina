import { useEffect, useRef, useState } from 'react';
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
import { applyMarkdownFontSize } from '@/lib/markdown/markdownFontSize';
import {
  type CommunitySettings,
  getCachedCommunitySettings,
  loadCommunitySettings,
} from '@/components/Settings/tabs/aboutCommunitySettings';
import {
  OPEN_SETTINGS_EVENT,
  resolveSettingsOpenTab,
  type OpenSettingsDetail,
  type SettingsOpenTab,
} from '@/components/Settings/settingsEvents';
import { installSyncE2EBridge } from '@/lib/e2e/syncE2EBridge';
import { AppContentShell } from './AppContentShell';
import { preloadAIStoreModule } from './AppContentModules';
import {
  INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS,
  useAppContentViewLifecycle,
} from './useAppContentViewLifecycle';

const UPDATE_AUTO_CHECK_DELAY_MS = 2500;
const UPDATE_AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_LAST_AUTO_CHECK_KEY = 'vlaina:update:lastAutoCheckAt';

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
  const appViewMode = useUIStore((state) => state.appViewMode);
  const fontSize = useUIStore((state) => state.fontSize);
  const restoreLastAppViewMode = useUIStore((state) => state.restoreLastAppViewMode);
  const restoreNotesChatFloatingSize = useUIStore((state) => state.restoreNotesChatFloatingSize);
  const unifiedLoaded = useUnifiedStore((state) => state.loaded);
  const lastConfiguredAppViewMode = useUnifiedStore((state) => state.data.settings.ui?.lastAppViewMode);
  const configuredNotesChatFloatingSize = useUnifiedStore((state) => state.data.settings.ui?.notesChatFloatingSize);
  const initialize = useVaultStore((state) => state.initialize);
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
  const [settingsRequestedTab, setSettingsRequestedTab] = useState<SettingsOpenTab | undefined>();
  const [hasOpenedSettings, setHasOpenedSettings] = useState(false);
  const [communitySettings, setCommunitySettings] = useState<CommunitySettings>(() => getCachedCommunitySettings());

  useEffect(() => {
    installSyncE2EBridge();
  }, []);

  const {
    handleActiveViewReady,
    handlePrimaryContentReady,
    handleStartupFallbackReady,
    mountedAppViews,
    renderedSidebarAppViews,
    shouldRenderCenterChrome,
    shouldRenderDeferredChrome,
  } = useAppContentViewLifecycle({
    appViewMode,
    effectiveAppViewMode,
    hasLaunchViewMode: Boolean(launchViewModeRef.current),
    initialUnifiedAppViewMode,
    shouldWaitForInitialUnifiedView,
  });

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
    if (settingsOpen) {
      setHasOpenedSettings(true);
      void loadCommunitySettings().then(setCommunitySettings);
    }
  }, [settingsOpen]);

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<OpenSettingsDetail>).detail;
      if (resolveSettingsOpenTab(detail?.tab)) {
        setSettingsRequestedTab(detail.tab);
      } else {
        setSettingsRequestedTab(undefined);
      }
      setSettingsOpen(true);
    };
    const handleToggleSettings = () => setSettingsOpen((open) => !open);
    window.addEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings);
    window.addEventListener('toggle-settings', handleToggleSettings);
    return () => {
      window.removeEventListener(OPEN_SETTINGS_EVENT, handleOpenSettings);
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

  useShortcuts();
  useSyncInit();
  useUnifiedExternalSync();

  useEffect(() => {
    if (!unifiedLoaded) return;

    let cancelled = false;
    void preloadAIStoreModule()
      .then((mod) => {
        if (cancelled) return;
        mod.startAIStoreRuntimeEffects?.();
      })
      .catch((_error) => {
      });

    return () => {
      cancelled = true;
    };
  }, [unifiedLoaded]);

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
    if (!unifiedLoaded || !configuredNotesChatFloatingSize) return;
    restoreNotesChatFloatingSize(configuredNotesChatFloatingSize);
  }, [configuredNotesChatFloatingSize, restoreNotesChatFloatingSize, unifiedLoaded]);

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
    applyMarkdownFontSize(fontSize);
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

  return (
    <AppContentShell
      communitySettings={communitySettings}
      effectiveAppViewMode={effectiveAppViewMode}
      hasOpenedSettings={hasOpenedSettings}
      mountedAppViews={mountedAppViews}
      onActiveViewReady={handleActiveViewReady}
      onPrimaryContentReady={handlePrimaryContentReady}
      onSettingsClose={() => setSettingsOpen(false)}
      onStartupFallbackReady={handleStartupFallbackReady}
      renderedSidebarAppViews={renderedSidebarAppViews}
      settingsOpen={settingsOpen}
      settingsRequestedTab={settingsRequestedTab}
      shouldRenderCenterChrome={shouldRenderCenterChrome}
      shouldRenderDeferredChrome={shouldRenderDeferredChrome}
      shouldWaitForInitialUnifiedView={shouldWaitForInitialUnifiedView}
    />
  );
}
