import { useEffect } from 'react';
import { APP_VERSION } from '@/lib/appVersion';
import { clearStaleDesktopUpdateDownload, startDesktopUpdateDownload } from '@/lib/desktop/updateDownload';
import {
  clearCachedDesktopUpdateInfo,
  normalizeDesktopUpdateInfo,
  readCachedDesktopUpdateInfo,
  readStoredUpdateCheckTimestamp,
  writeCachedDesktopUpdateInfo,
  writeStoredUpdateCheckTimestamp,
} from '@/lib/desktop/updateStatus';
import { getElectronBridge } from '@/lib/electron/bridge';
import { translate } from '@/lib/i18n';
import { useToastStore } from '@/stores/useToastStore';

const UPDATE_AUTO_CHECK_DELAY_MS = 2500;
const UPDATE_AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const UPDATE_AUTO_CHECK_RETRY_MS = 15 * 60 * 1000;

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

export function getDesktopUpdateAutoCheckDelay(lastCheckedAt: number, now = Date.now()) {
  if (!Number.isFinite(lastCheckedAt) || lastCheckedAt <= 0) {
    return UPDATE_AUTO_CHECK_DELAY_MS;
  }

  const elapsedMs = Math.max(0, now - lastCheckedAt);
  return Math.max(UPDATE_AUTO_CHECK_DELAY_MS, UPDATE_AUTO_CHECK_INTERVAL_MS - elapsedMs);
}

export function useDesktopUpdateRuntime() {
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

        const scheduleAutoCheck = (delayMs: number) => {
          if (cancelled) return;
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
          }
          timeoutId = window.setTimeout(() => {
            void performAutoCheck();
          }, delayMs);
        };

        const performAutoCheck = async () => {
          try {
            await runDesktopUpdateAutoCheck({
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
            });
            scheduleAutoCheck(UPDATE_AUTO_CHECK_INTERVAL_MS);
          } catch {
            scheduleAutoCheck(UPDATE_AUTO_CHECK_RETRY_MS);
          }
        };

        scheduleAutoCheck(getDesktopUpdateAutoCheckDelay(readStoredUpdateCheckTimestamp()));
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
}
