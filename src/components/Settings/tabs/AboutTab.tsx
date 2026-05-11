import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { getElectronBridge } from '@/lib/electron/bridge';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import { SettingsSectionHeader } from '../components/SettingsControls';
import { useI18n } from '@/lib/i18n';

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

const fallbackDownloadUrl = 'https://github.com/vladelaina/vlaina/releases/latest';
const privacyPolicyUrl = 'https://github.com/vladelaina/vlaina/blob/main/PRIVACY.md';

export function AboutTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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
      setErrorMessage(t('settings.about.updateDesktopOnly'));
      return;
    }

    setStatus('checking');
    setErrorMessage('');

    try {
      const nextInfo = await bridge.update.check();
      setUpdateInfo(nextInfo);
      setStatus(nextInfo.updateAvailable ? 'available' : 'current');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('settings.about.updateFailed'));
    }
  }, [t]);

  const openDownloadPage = useCallback(() => {
    void openExternalHref(updateInfo?.downloadUrl || fallbackDownloadUrl);
  }, [updateInfo?.downloadUrl]);

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
            {currentVersion || '0.1.0'}
          </span>
        </div>
        <p className="mt-2 max-w-[560px] text-[13px] leading-6 text-[var(--notes-sidebar-text-soft)]">
          {t('settings.about.versionDescription')}
        </p>
      </div>

      <div>
        <SettingsSectionHeader>{t('settings.about.updates')}</SettingsSectionHeader>
        <div className="rounded-[22px] border border-zinc-200/70 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#202020]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-[var(--notes-sidebar-text)]">
                <span>{t('settings.about.downloadUpdates')}</span>
                {statusLabel ? (
                  <span
                    title={status === 'error' ? errorMessage || undefined : undefined}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      status === 'error'
                        ? 'bg-red-50 text-red-500 dark:bg-red-500/10'
                        : 'bg-zinc-100 text-[var(--notes-sidebar-text-soft)] dark:bg-white/10'
                    )}
                  >
                    {statusLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={checkForUpdates}
                disabled={status === 'checking'}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-[13px] font-medium text-[var(--notes-sidebar-text)] transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#242424] dark:hover:bg-white/10"
              >
                <RefreshCw size={15} className={cn(status === 'checking' && 'animate-spin')} />
                {t('common.check')}
              </button>
              <button
                type="button"
                onClick={openDownloadPage}
                className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#1E96EB] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#167fd0]"
              >
                {status === 'available' ? <Download size={15} /> : <ExternalLink size={15} />}
                {t('common.download')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SettingsSectionHeader>{t('settings.about.privacy')}</SettingsSectionHeader>
        <div className="rounded-[22px] border border-zinc-200/70 bg-white px-6 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-white/10 dark:bg-[#202020]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[var(--notes-sidebar-text)]">
                {t('settings.about.openPrivacyPolicy')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openExternalHref(privacyPolicyUrl)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-[13px] font-medium text-[var(--notes-sidebar-text)] transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-[#242424] dark:hover:bg-white/10"
            >
              <ExternalLink size={15} />
              {t('common.open')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
