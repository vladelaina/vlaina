import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/appVersion';

type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'error';

interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
  releaseUrl: string;
  platformAssetName: string;
  hasPlatformAsset: boolean;
  releaseNotes: string;
  publishedAt: string;
}

const privacyPolicyUrl = 'https://github.com/vladelaina/vlaina/blob/main/PRIVACY.md';

export function AboutTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    const bridge = getElectronBridge();
    if (!bridge?.app) {
      return;
    }

    void bridge.app.getVersion().then((version) => {
      setCurrentVersion(version);
    }).catch(() => {
      setCurrentVersion('');
    });
  }, []);

  const checkForUpdates = useCallback(async () => {
    const bridge = getElectronBridge();
    if (!bridge?.update) {
      setStatus('error');
      return;
    }

    setStatus('checking');

    try {
      const nextInfo = await bridge.update.check();
      setUpdateInfo(nextInfo);
      setStatus(nextInfo.updateAvailable ? 'available' : 'current');
    } catch (error) {
      setStatus('error');
    }
  }, [t]);

  const hasUpdate = status === 'available' && Boolean(updateInfo);

  const openUpdateDownload = useCallback(() => {
    if (!hasUpdate || !updateInfo?.downloadUrl) return;
    void openExternalHref(updateInfo.downloadUrl);
  }, [hasUpdate, updateInfo?.downloadUrl]);

  const statusLabel = (() => {
    if (status === 'checking') return t('common.checking');
    if (status === 'available' && updateInfo) return t('settings.about.updateAvailable', { version: updateInfo.latestVersion });
    if (status === 'current') return t('settings.about.upToDate');
    if (status === 'error') return t('common.checkFailed');
    return '';
  })();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[26px] font-semibold tracking-tight text-[var(--notes-sidebar-text)]">
          vlaina
        </h2>
        <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--notes-sidebar-text-soft)]">
          <span>{t('settings.about.version')}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-[var(--notes-sidebar-text)] dark:bg-white/10">
            {currentVersion || APP_VERSION}
          </span>
        </div>
      </div>

      <div>
        <SettingsSectionHeader>{t('settings.about.updates')}</SettingsSectionHeader>
        <SettingsItem
          title={t('settings.about.updates')}
          description={statusLabel || undefined}
          className="hover:!shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={checkForUpdates}
              disabled={status === 'checking'}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-medium text-[var(--notes-sidebar-text)] transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#242424] dark:hover:bg-white/10"
            >
              <RefreshCw size={15} className={cn(status === 'checking' && 'animate-spin')} />
              {t('common.check')}
            </button>
            {hasUpdate ? (
              <button
                type="button"
                onClick={openUpdateDownload}
                title={updateInfo?.platformAssetName || undefined}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1E96EB] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#167fd0]"
              >
                <ExternalLink size={15} />
                {t('settings.about.updateAction')}
              </button>
            ) : null}
          </div>
        </SettingsItem>
      </div>

      <div>
        <SettingsSectionHeader>{t('settings.about.privacy')}</SettingsSectionHeader>
        <SettingsItem title={t('settings.about.openPrivacyPolicy')} className="hover:!shadow-[0_4px_16px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]">
          <button
            type="button"
            onClick={() => void openExternalHref(privacyPolicyUrl)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-[13px] font-medium text-[var(--notes-sidebar-text)] transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-[#242424] dark:hover:bg-white/10"
          >
            <ExternalLink size={15} />
            {t('common.open')}
          </button>
        </SettingsItem>
      </div>
    </div>
  );
}
