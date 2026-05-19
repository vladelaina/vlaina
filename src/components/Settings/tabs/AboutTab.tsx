import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { FaDiscord, FaQq, FaWeixin } from 'react-icons/fa';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { getElectronBridge } from '@/lib/electron/bridge';
import { getExternalLinkProps, openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { useI18n } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/appVersion';
import {
  type CommunitySettings,
  getCachedCommunitySettings,
  loadCommunitySettings,
} from './aboutCommunitySettings';

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
const discordInviteUrl = 'https://discord.gg/nvsh9QpTqS';
const communityPillClassName =
  'inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12px] font-semibold text-[var(--notes-sidebar-text)] transition-all duration-200';

function CommunityQrPill({
  title,
  label,
  icon,
  qrText,
  detail,
}: {
  title: string;
  label: string;
  icon: ReactNode;
  qrText: string;
  detail?: string;
}) {
  const [shouldRenderQr, setShouldRenderQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (!shouldRenderQr || !qrText) {
      setQrDataUrl('');
      return;
    }

    let cancelled = false;
    void import('qrcode')
      .then((QRCode) => QRCode.toString(qrText, {
        color: {
          dark: '#97c7ecff',
          light: '#ffffff00',
        },
        errorCorrectionLevel: 'M',
        margin: 1,
        type: 'svg',
        width: 144,
      }))
      .then((svg) => {
        if (!cancelled) {
          setQrDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrText, shouldRenderQr]);

  return (
    <div className="group relative" onMouseEnter={() => setShouldRenderQr(true)} onFocus={() => setShouldRenderQr(true)}>
      <button
        type="button"
        aria-label={title}
        className={cn(communityPillClassName, chatComposerPillSurfaceClass)}
      >
        {icon}
        <span>{label}</span>
      </button>
      <div className={cn(
        'pointer-events-none absolute left-1/2 top-full z-20 mt-3 w-[168px] -translate-x-1/2 rounded-[26px] p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100',
        chatComposerPillSurfaceClass
      )}>
        {detail ? (
          <div className="mb-1 truncate text-center text-[12px] font-bold tabular-nums text-[var(--notes-sidebar-text)]">
            {detail}
          </div>
        ) : null}
        <div className="flex aspect-square w-full items-center justify-center rounded-[20px] text-[var(--notes-sidebar-text-soft)]">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={title} className="h-full w-full rounded-[16px] object-contain" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[12px] font-medium">
              <QrCode size={34} strokeWidth={1.7} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscordPill() {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => void openExternalHref(discordInviteUrl)}
      aria-label={t('settings.about.openDiscord')}
      className={cn(communityPillClassName, chatComposerPillSurfaceClass)}
    >
      <FaDiscord size={15} className="text-[#5865F2]" />
      <span>{t('settings.about.discord')}</span>
    </button>
  );
}

function CommunityPills({ community }: { community: CommunitySettings }) {
  const { t } = useI18n();
  const hasQq = Boolean(community.qqQrCodeText);
  const hasWechat = Boolean(community.wechatQrCodeText);

  return (
    <div className="flex flex-wrap items-center gap-2 px-2">
      <DiscordPill />
      {hasQq ? (
        <CommunityQrPill
          title={t('settings.about.qqGroup')}
          label="QQ"
          icon={<FaQq size={15} className="text-[#12B7F5]" />}
          qrText={community.qqQrCodeText}
          detail={community.qqGroupNumber || undefined}
        />
      ) : null}
      {hasWechat ? (
        <CommunityQrPill
          title={t('settings.about.wechatGroup')}
          label="WeChat"
          icon={<FaWeixin size={15} className="text-[#07C160]" />}
          qrText={community.wechatQrCodeText}
        />
      ) : null}
    </div>
  );
}

export function AboutTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState('');
  const [community, setCommunity] = useState<CommunitySettings>(() => getCachedCommunitySettings());

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

  useEffect(() => {
    let cancelled = false;
    void loadCommunitySettings().then((settings) => {
      if (!cancelled) {
        setCommunity(settings);
      }
    });

    return () => {
      cancelled = true;
    };
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
      <div className="flex items-center gap-7 py-2">
        <img
          src="/logo.png"
          alt="vlaina"
          className="h-32 w-32 shrink-0 rounded-[28px] object-contain"
          draggable={false}
        />
        <div className="min-w-0 pt-1">
          <a
            {...getExternalLinkProps('https://vlaina.com')}
            className="inline-block max-w-full truncate text-[22px] font-semibold leading-7 text-[var(--vlaina-accent)]"
          >
            vlaina
          </a>
          <div className="mt-1 truncate text-[13px] font-normal leading-5 text-[var(--notes-sidebar-text-soft)] tabular-nums">
            {currentVersion || APP_VERSION}
          </div>
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

      <CommunityPills community={community} />

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
