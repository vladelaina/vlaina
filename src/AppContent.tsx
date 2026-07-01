import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  clearCachedDesktopUpdateInfo,
  normalizeDesktopUpdateInfo,
  readCachedDesktopUpdateInfo,
  readStoredUpdateCheckTimestamp,
  writeCachedDesktopUpdateInfo,
  writeStoredUpdateCheckTimestamp,
} from '@/lib/desktop/updateStatus';
import { clearStaleDesktopUpdateDownload, startDesktopUpdateDownload } from '@/lib/desktop/updateDownload';
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
import { AppContentShell } from './AppContentShell';
import { preloadAIStoreModule } from './AppContentModules';
import {
  INITIAL_UNIFIED_VIEW_WAIT_TIMEOUT_MS,
  useAppContentViewLifecycle,
} from './useAppContentViewLifecycle';

const UPDATE_AUTO_CHECK_DELAY_MS = 2500;
const UPDATE_AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const E2E_LOCAL_STORAGE_KEY = 'vlaina:e2e:enabled';

interface DesktopUpdateAutoCheckInfo {
  latestVersion?: string;
  updateAvailable: boolean;
}

interface DesktopUpdateAutoCheckOptions {
  checkForUpdates: () => Promise<DesktopUpdateAutoCheckInfo>;
  recordUpdateInfo?: (updateInfo: DesktopUpdateAutoCheckInfo) => void;
  notifyUpdateAvailable: (updateInfo: DesktopUpdateAutoCheckInfo) => void;
  markCheckedAt: (timestamp: number) => void;
  getNow?: () => number;
  isCancelled?: () => boolean;
}

export async function runDesktopUpdateAutoCheck({
  checkForUpdates,
  recordUpdateInfo = () => {},
  notifyUpdateAvailable,
  markCheckedAt,
  getNow = Date.now,
  isCancelled = () => false,
}: DesktopUpdateAutoCheckOptions) {
  const updateInfo = await checkForUpdates();
  if (isCancelled()) return;

  recordUpdateInfo(updateInfo);

  if (updateInfo.updateAvailable) {
    notifyUpdateAvailable(updateInfo);
  }

  markCheckedAt(getNow());
}

function shouldInstallSyncE2EBridge() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('e2e') === '1' || window.localStorage.getItem(E2E_LOCAL_STORAGE_KEY) === '1';
  } catch {
    return false;
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
    if (!shouldInstallSyncE2EBridge()) return;

    void import('@/lib/e2e/syncE2EBridge')
      .then((mod) => {
        mod.installSyncE2EBridge();
      })
      .catch(() => {
      });
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

    let cancelled = false;
    let timeoutId: number | undefined;

    void Promise.resolve(
      typeof bridge.update.getPolicy === 'function'
        ? bridge.update.getPolicy().catch(() => ({
          checkEnabled: true,
          backgroundDownloadEnabled: true,
        }))
        : {
          checkEnabled: true,
          backgroundDownloadEnabled: true,
        }
    )
      .then((updatePolicy) => {
        if (cancelled) return;

        const cachedUpdateInfo = readCachedDesktopUpdateInfo();
        if (cachedUpdateInfo && !updatePolicy.checkEnabled) {
          void bridge.update!.deleteDownloaded?.(cachedUpdateInfo).catch(() => {
          });
          clearCachedDesktopUpdateInfo();
          return;
        }

        if (cachedUpdateInfo) {
          void clearStaleDesktopUpdateDownload(bridge.update!, cachedUpdateInfo, APP_VERSION)
            .then((freshUpdateInfo) => {
              if (freshUpdateInfo && !cancelled && updatePolicy.backgroundDownloadEnabled !== false) {
                startDesktopUpdateDownload(bridge.update!, freshUpdateInfo);
              }
            });
        }

        if (!updatePolicy.checkEnabled) return;

        const lastCheckedAt = readStoredUpdateCheckTimestamp();
        if (lastCheckedAt > 0 && Date.now() - lastCheckedAt < UPDATE_AUTO_CHECK_INTERVAL_MS) {
          return;
        }

        timeoutId = window.setTimeout(() => {
          void runDesktopUpdateAutoCheck({
            checkForUpdates: () => bridge.update!.check(),
            recordUpdateInfo: (updateInfo) => {
              const normalizedInfo = normalizeDesktopUpdateInfo(updateInfo);
              if (normalizedInfo) {
                void clearStaleDesktopUpdateDownload(bridge.update!, normalizedInfo, APP_VERSION)
                  .then((freshUpdateInfo) => {
                    if (!freshUpdateInfo || cancelled) return;
                    writeCachedDesktopUpdateInfo(freshUpdateInfo);
                    startDesktopUpdateDownload(bridge.update!, freshUpdateInfo);
                  });
              }
            },
            notifyUpdateAvailable: (updateInfo) => {
              useToastStore.getState().addToast(
                translate('settings.about.updateToastAvailable', { version: updateInfo.latestVersion || APP_VERSION }),
                'info',
                8000,
              );
            },
            markCheckedAt: (timestamp) => {
              writeStoredUpdateCheckTimestamp(timestamp);
            },
            isCancelled: () => cancelled,
          })
            .catch(() => {
            });
        }, UPDATE_AUTO_CHECK_DELAY_MS);
      })
      .catch(() => {
      });

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
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

  useLayoutEffect(() => {
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
