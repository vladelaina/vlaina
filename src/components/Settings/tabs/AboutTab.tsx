import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/appVersion';
import {
  canOpenDesktopUpdateExternalDownload,
  canOpenDesktopUpdateLocalInstaller,
  type DesktopUpdateInfo,
  isDesktopUpdateNewerThanCurrent,
  readCachedDesktopUpdateInfo,
  UPDATE_INFO_CHANGED_EVENT,
  writeCachedDesktopUpdateInfo,
} from '@/lib/desktop/updateStatus';
import { clearStaleDesktopUpdateDownload, startDesktopUpdateDownload } from '@/lib/desktop/updateDownload';
import { useAccountSessionStore } from '@/stores/accountSession';
import { FeedbackTab } from './FeedbackTab';
import { themeIconTokens } from '@/styles/themeTokens';
import { settingsSelectedActionButtonClassName } from '../styles';
import type { CommunitySettings } from './aboutCommunitySettings';
import { AboutHero } from './AboutHero';
import { CommunityPills } from './AboutCommunityPills';
import { DeveloperNotePanel } from './AboutDeveloperNotePanel';
import { privacyPolicyUrl, termsOfServiceUrl } from './aboutTabShared';

type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'error';
type UpdateInfo = DesktopUpdateInfo;

function readInitialUpdateState(): { status: UpdateStatus; updateInfo: UpdateInfo | null } {
  const cachedUpdateInfo = readCachedDesktopUpdateInfo();
  if (!cachedUpdateInfo || !isDesktopUpdateNewerThanCurrent(cachedUpdateInfo)) {
    return { status: 'idle', updateInfo: null };
  }

  return {
    status: cachedUpdateInfo.updateAvailable ? 'available' : 'current',
    updateInfo: cachedUpdateInfo,
  };
}

export function AboutTab({ community }: { community: CommunitySettings }) {
  const { t } = useI18n();
  const isAccountConnected = useAccountSessionStore((state) => state.isConnected);
  const [status, setStatus] = useState<UpdateStatus>(() => readInitialUpdateState().status);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(() => readInitialUpdateState().updateInfo);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    const bridge = getElectronBridge();
    if (!bridge?.app) {
      return;
    }

    void bridge.app.getVersion().then((version) => {
      setCurrentVersion(version);
      const cachedUpdateInfo = readCachedDesktopUpdateInfo();
      if (cachedUpdateInfo && bridge.update) {
        void clearStaleDesktopUpdateDownload(bridge.update, cachedUpdateInfo, version);
      }
    }).catch(() => {
      setCurrentVersion('');
    });
  }, []);

  useEffect(() => {
    const applyCachedUpdateInfo = () => {
      const cachedUpdateInfo = readCachedDesktopUpdateInfo();
      const freshUpdateInfo = cachedUpdateInfo && isDesktopUpdateNewerThanCurrent(cachedUpdateInfo, currentVersion || APP_VERSION)
        ? cachedUpdateInfo
        : null;
      setUpdateInfo(freshUpdateInfo);
      setStatus(freshUpdateInfo
        ? freshUpdateInfo.updateAvailable ? 'available' : 'current'
        : 'idle');
    };

    window.addEventListener(UPDATE_INFO_CHANGED_EVENT, applyCachedUpdateInfo);
    return () => {
      window.removeEventListener(UPDATE_INFO_CHANGED_EVENT, applyCachedUpdateInfo);
    };
  }, [currentVersion]);

  const checkForUpdates = useCallback(async () => {
    const bridge = getElectronBridge();
    if (!bridge?.update) {
      setStatus('error');
      return;
    }

    setStatus('checking');

    try {
      const nextInfo = await bridge.update.check();
      const freshUpdateInfo = await clearStaleDesktopUpdateDownload(
        bridge.update,
        nextInfo,
        currentVersion || nextInfo.currentVersion || APP_VERSION
      );
      if (!freshUpdateInfo) {
        setUpdateInfo(null);
        setStatus('current');
        return;
      }
      setUpdateInfo(freshUpdateInfo);
      setStatus('available');
      writeCachedDesktopUpdateInfo(freshUpdateInfo);
      startDesktopUpdateDownload(bridge.update, freshUpdateInfo);
    } catch (error) {
      setStatus((previousStatus) => previousStatus === 'available' && updateInfo ? 'available' : 'error');
    }
  }, [currentVersion, updateInfo]);

  const hasUpdate = status === 'available' && Boolean(updateInfo);

  const openUpdateDownload = useCallback(() => {
    if (!hasUpdate || !updateInfo?.downloadUrl) return;
    if (
      canOpenDesktopUpdateLocalInstaller(updateInfo) &&
      updateInfo.downloadState === 'downloaded' &&
      updateInfo.platformAssetSha256 &&
      updateInfo.downloadedFilePath
    ) {
      const bridge = getElectronBridge();
      if (bridge?.update?.openDownloaded) {
        void bridge.update.openDownloaded(updateInfo)
          .catch(() => {
            if (canOpenDesktopUpdateExternalDownload(updateInfo)) {
              void openExternalHref(updateInfo.downloadUrl);
            }
          });
        return;
      }
    }
    if (canOpenDesktopUpdateExternalDownload(updateInfo)) {
      void openExternalHref(updateInfo.downloadUrl);
    }
  }, [hasUpdate, updateInfo]);

  const statusLabel = (() => {
    if (status === 'checking') return t('common.checking');
    if (status === 'available' && updateInfo) return t('settings.about.updateAvailable', { version: updateInfo.latestVersion });
    if (status === 'current') return t('settings.about.upToDate');
    if (status === 'error') return t('common.checkFailed');
    return '';
  })();

  return (
    <div className="space-y-8" data-settings-tab-panel="about">
      <AboutHero version={currentVersion || APP_VERSION} />

      <div>
        <SettingsSectionHeader>{t('settings.about.updates')}</SettingsSectionHeader>
        <SettingsItem
          title={t('settings.about.updates')}
          description={statusLabel || undefined}
          className="hover:!shadow-[var(--vlaina-shadow-raised-soft)]"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={checkForUpdates}
              disabled={status === 'checking'}
              className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-[var(--vlaina-color-setting-field)] px-4 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] transition-colors hover:bg-[var(--vlaina-sidebar-row-selected-bg)] hover:text-[var(--vlaina-sidebar-row-selected-text)] hover:shadow-[var(--vlaina-shadow-selection-soft)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-60)]"
            >
              <RefreshCw size={themeIconTokens.sizeSidebar} className={cn(status === 'checking' && 'animate-spin')} />
              {t('common.check')}
            </button>
            {hasUpdate ? (
              <button
                type="button"
                onClick={openUpdateDownload}
                className={settingsSelectedActionButtonClassName}
              >
                <ExternalLink size={themeIconTokens.sizeSidebar} />
                {t('settings.about.updateAction')}
              </button>
            ) : null}
          </div>
        </SettingsItem>
      </div>

      <CommunityPills community={community} />

      {isAccountConnected ? <FeedbackTab compact /> : null}

      <div>
        <SettingsSectionHeader>{t('settings.about.legal')}</SettingsSectionHeader>
        <SettingsItem title={t('settings.about.openPrivacyPolicy')} className="hover:!shadow-[var(--vlaina-shadow-raised-soft)]">
          <button
            type="button"
            onClick={() => void openExternalHref(privacyPolicyUrl)}
            className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-[var(--vlaina-color-setting-field)] px-4 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] transition-colors hover:bg-[var(--vlaina-sidebar-row-selected-bg)] hover:text-[var(--vlaina-sidebar-row-selected-text)] hover:shadow-[var(--vlaina-shadow-selection-soft)]"
          >
            <ExternalLink size={themeIconTokens.sizeSidebar} />
            {t('common.open')}
          </button>
        </SettingsItem>
        <SettingsItem title={t('settings.about.openTermsOfService')} className="hover:!shadow-[var(--vlaina-shadow-raised-soft)]">
          <button
            type="button"
            onClick={() => void openExternalHref(termsOfServiceUrl)}
            className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-[var(--vlaina-color-setting-field)] px-4 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] transition-colors hover:bg-[var(--vlaina-sidebar-row-selected-bg)] hover:text-[var(--vlaina-sidebar-row-selected-text)] hover:shadow-[var(--vlaina-shadow-selection-soft)]"
          >
            <ExternalLink size={themeIconTokens.sizeSidebar} />
            {t('common.open')}
          </button>
        </SettingsItem>
      </div>

      <DeveloperNotePanel />
    </div>
  );
}
