import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { FaDiscord, FaGithub, FaQq, FaWeixin } from 'react-icons/fa';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { getElectronBridge } from '@/lib/electron/bridge';
import { getExternalLinkProps, openExternalHref } from '@/lib/navigation/externalLinks';
import { cn } from '@/lib/utils';
import { SettingsItem, SettingsSectionHeader } from '../components/SettingsControls';
import { useI18n, type AppLanguage, type MessageKey, type MessageValues } from '@/lib/i18n';
import { APP_VERSION } from '@/lib/appVersion';
import { useAccountSessionStore } from '@/stores/accountSession';
import { FeedbackTab } from './FeedbackTab';
import {
  type CommunitySettings,
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
const githubRepositoryUrl = 'https://github.com/vladelaina/vlaina';
const discordInviteUrl = 'https://discord.gg/nvsh9QpTqS';
const appLogoUrl = `${import.meta.env.BASE_URL}logo.png`;
const communityPillClassName =
  'inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12px] font-semibold text-[var(--notes-sidebar-text)] transition-all duration-200';
const richTokenPattern = /(\{vlainaSite\}|\{catimeSite\}|\{authorSite\}|\{clockTopic\})/g;

const cnyEquivalentByLanguage: Record<AppLanguage, { currency: string; amount: number; locale: string }> = {
  en: { currency: 'USD', amount: 441, locale: 'en-US' },
  'zh-CN': { currency: 'CNY', amount: 3000, locale: 'zh-CN' },
  'zh-Hant': { currency: 'TWD', amount: 13300, locale: 'zh-TW' },
  ja: { currency: 'JPY', amount: 68800, locale: 'ja-JP' },
  ko: { currency: 'KRW', amount: 617000, locale: 'ko-KR' },
  fr: { currency: 'EUR', amount: 392, locale: 'fr-FR' },
  de: { currency: 'EUR', amount: 392, locale: 'de-DE' },
  es: { currency: 'EUR', amount: 392, locale: 'es-ES' },
  'pt-BR': { currency: 'BRL', amount: 2490, locale: 'pt-BR' },
  it: { currency: 'EUR', amount: 392, locale: 'it-IT' },
  ru: { currency: 'RUB', amount: 35300, locale: 'ru-RU' },
  tr: { currency: 'TRY', amount: 17200, locale: 'tr-TR' },
  vi: { currency: 'VND', amount: 11470000, locale: 'vi-VN' },
  id: { currency: 'IDR', amount: 7190000, locale: 'id-ID' },
  th: { currency: 'THB', amount: 14300, locale: 'th-TH' },
};

function formatCnyEquivalent(language: AppLanguage, cnyAmount: number): string {
  const equivalent = cnyEquivalentByLanguage[language] ?? cnyEquivalentByLanguage.en;
  const amount = cnyAmount === 3000 ? equivalent.amount : Math.round((equivalent.amount / 3000) * cnyAmount);

  return new Intl.NumberFormat(equivalent.locale, {
    style: 'currency',
    currency: equivalent.currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps(href)}>
      {children}
    </a>
  );
}

function renderRichText(text: string): ReactNode[] {
  const tokens: Record<string, ReactNode> = {
    '{vlainaSite}': <ExternalTextLink href="https://vlaina.com">vlaina</ExternalTextLink>,
    '{catimeSite}': <ExternalTextLink href="https://cati.me">Catime</ExternalTextLink>,
    '{authorSite}': <ExternalTextLink href="https://vladelaina.com">vladelaina</ExternalTextLink>,
    '{clockTopic}': <ExternalTextLink href="https://github.com/topics/clock">Topics clock</ExternalTextLink>,
  };

  return text.split(richTokenPattern).map((part, index) => (
    <span key={`${part}-${index}`}>{tokens[part] ?? part}</span>
  ));
}

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

function GithubPill() {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => void openExternalHref(githubRepositoryUrl)}
      aria-label={t('settings.about.openGithub')}
      className={cn(communityPillClassName, chatComposerPillSurfaceClass)}
    >
      <FaGithub size={15} className="text-[var(--notes-sidebar-text)]" />
      <span>{t('settings.about.github')}</span>
    </button>
  );
}

function CommunityPills({ community }: { community: CommunitySettings }) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2 px-2">
      <GithubPill />
      <DiscordPill />
      <CommunityQrPill
        title={t('settings.about.qqGroup')}
        label="QQ"
        icon={<FaQq size={15} className="text-[#12B7F5]" />}
        qrText={community.qqQrCodeText}
        detail={community.qqGroupNumber || undefined}
      />
      <CommunityQrPill
        title={t('settings.about.wechatGroup')}
        label="WeChat"
        icon={<FaWeixin size={15} className="text-[#07C160]" />}
        qrText={community.wechatQrCodeText}
      />
    </div>
  );
}

function DeveloperNotePanel() {
  const { language, t } = useI18n();
  const catimeIncome = formatCnyEquivalent(language, 3000);
  const noteText = (key: MessageKey, values?: MessageValues) => renderRichText(t(key, values));

  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(255,255,255,0.38))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(28,28,28,0.92),rgba(24,24,24,0.84))]">
      <div className="space-y-4 text-[14px] leading-7 text-[var(--notes-sidebar-text)]">
        <p className="text-[22px] font-semibold leading-8 text-[var(--notes-sidebar-text)]">
          {noteText('settings.about.note.intro')}
        </p>
        <p>{t('settings.about.note.curiousTitle')}</p>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-7 text-[var(--notes-sidebar-text)]">
          <li><strong>{t('settings.about.note.curiousMissing')}</strong></li>
          <li><strong>{t('settings.about.note.curiousRough')}</strong></li>
          <li><strong>{t('settings.about.note.curiousPaid')}</strong></li>
        </ol>
        <p>{t('settings.about.note.originStory')}</p>
        <p>{noteText('settings.about.note.migrationStory', { catimeSize: '200 KB', catimeStars: '4,000', targetSize: '20 MB' })}</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.releaseHeading')}
        </h2>
        <p>{t('settings.about.note.releaseReason')}</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.donationHeading')}
        </h2>
        <p>{t('settings.about.note.donationReason')}</p>
        <p>{noteText('settings.about.note.catimeStory', { catimeStars: '4,000' })}</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.earnHeading')}
        </h2>
        <p>{noteText('settings.about.note.catimeIncome', { catimeIncome })}</p>
        <p>{t('settings.about.note.graduated')}</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.jobHeading')}
        </h2>
        <p>{noteText('settings.about.note.jobStory')}</p>
        <p>{noteText('settings.about.note.afterWorkStory')}</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.weekendHeading')}
        </h2>
        <p>{t('settings.about.note.weekendStory')}</p>
        <p>{t('settings.about.note.resignationStory')}</p>
        <h3 className="text-[14px] font-semibold leading-6 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.resignationQuoteHeading')}
        </h3>
        <div className="rounded-[18px] border border-white/10 bg-black/5 px-4 py-3 text-[13px] leading-6 text-[var(--notes-sidebar-text-soft)] dark:bg-white/5">
          <p className="mt-3 whitespace-pre-wrap">
            {noteText('settings.about.note.resignationQuote')}
          </p>
        </div>
        <p>{t('settings.about.note.newProject')}</p>
        <h2 className="text-[16px] font-semibold leading-7 text-[var(--notes-sidebar-text)]">
          {t('settings.about.note.paidHeading')}
        </h2>
        <p>{t('settings.about.note.paidAnswer')}</p>
        <p>{t('settings.about.note.valueAnswer')}</p>
        <p>{t('settings.about.note.supportMembership')}</p>
        <p>{t('settings.about.note.feedback')}</p>
        <p className="text-[var(--vlaina-color-brand-pink)]">
          {noteText('settings.about.note.thanks')}
        </p>
      </div>
    </div>
  );
}

export function AboutTab({ community }: { community: CommunitySettings }) {
  const { t } = useI18n();
  const isAccountConnected = useAccountSessionStore((state) => state.isConnected);
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
      <div className="flex items-center gap-7 py-2">
        <img
          src={appLogoUrl}
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

      {isAccountConnected ? <FeedbackTab compact /> : null}

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

      <DeveloperNotePanel />
    </div>
  );
}
