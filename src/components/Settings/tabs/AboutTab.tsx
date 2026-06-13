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
import { themeColorTokens, themeIconTokens, themeQrTokens } from '@/styles/themeTokens';
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
const slackInviteUrl = 'https://join.slack.com/t/vlainafeedback/shared_invite/zt-406ohel4j-lIBFjHpDinWbMunatud_xA';
const appLogoUrl = `${import.meta.env.BASE_URL}logo.png`;
const communityPillClassName =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[var(--vlaina-font-xs)] font-semibold text-[var(--vlaina-sidebar-notes-text)] transition-all duration-[var(--vlaina-duration-200)]';
const richTokenPattern = /(\{appSite\}|\{catimeSite\}|\{authorSite\}|\{clockTopic\})/g;

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
    '{appSite}': <ExternalTextLink href="https://vlaina.com">vlaina</ExternalTextLink>,
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
          dark: themeColorTokens.qrForeground,
          light: themeColorTokens.transparentWhite,
        },
        errorCorrectionLevel: 'M',
        margin: themeQrTokens.marginModules,
        type: 'svg',
        width: themeQrTokens.widthPx,
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
        'pointer-events-none absolute left-1/2 top-full z-[var(--vlaina-z-20)] mt-3 w-[var(--vlaina-size-168px)] -translate-x-1/2 rounded-[var(--vlaina-radius-26px)] p-3 opacity-[var(--vlaina-opacity-0)] transition-opacity duration-[var(--vlaina-duration-150)] group-hover:opacity-[var(--vlaina-opacity-100)] group-focus-within:opacity-[var(--vlaina-opacity-100)]',
        chatComposerPillSurfaceClass
      )}>
        {detail ? (
          <div className="mb-1 truncate text-center text-[var(--vlaina-font-xs)] font-bold tabular-nums text-[var(--vlaina-sidebar-notes-text)]">
            {detail}
          </div>
        ) : null}
        <div className="flex aspect-square w-full items-center justify-center rounded-[var(--vlaina-radius-20px)] text-[var(--vlaina-sidebar-notes-text-soft)]">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={title} className="h-full w-full rounded-[var(--vlaina-radius-16px)] object-contain" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[var(--vlaina-font-xs)] font-medium">
              <QrCode
                size={themeIconTokens.sizeQrPlaceholder}
                strokeWidth={themeIconTokens.strokeQrPlaceholder}
              />
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
      <FaDiscord size={themeIconTokens.sizeSidebar} className="text-[var(--vlaina-brand-discord)]" />
      <span>{t('settings.about.discord')}</span>
    </button>
  );
}

function SlackLogoIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" />
      <path fill="#E01E5A" d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
      <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" />
      <path fill="#36C5F0" d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
      <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" />
      <path fill="#2EB67D" d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
      <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z" />
      <path fill="#ECB22E" d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

function SlackPill() {
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => void openExternalHref(slackInviteUrl)}
      aria-label={t('settings.about.openSlack')}
      className={cn(communityPillClassName, chatComposerPillSurfaceClass)}
    >
      <SlackLogoIcon size={themeIconTokens.sizeSidebar} />
      <span>{t('settings.about.slack')}</span>
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
      <FaGithub size={themeIconTokens.sizeSidebar} className="text-[var(--vlaina-sidebar-notes-text)]" />
      <span>{t('settings.about.github')}</span>
    </button>
  );
}

function CommunityPills({ community }: { community: CommunitySettings }) {
  const { t } = useI18n();

  return (
    <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-visible px-1.5 py-1 max-[420px]:gap-1 max-[420px]:px-0">
      <GithubPill />
      <DiscordPill />
      <SlackPill />
      <CommunityQrPill
        title={t('settings.about.qqGroup')}
        label="QQ"
        icon={<FaQq size={themeIconTokens.sizeSidebar} className="text-[var(--vlaina-brand-qq)]" />}
        qrText={community.qqQrCodeText}
        detail={community.qqGroupNumber || undefined}
      />
      <CommunityQrPill
        title={t('settings.about.wechatGroup')}
        label="WeChat"
        icon={<FaWeixin size={themeIconTokens.sizeSidebar} className="text-[var(--vlaina-brand-wechat)]" />}
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
    <div className="min-w-0 rounded-[var(--vlaina-radius-24px)] border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-panel-glass)] p-5 shadow-[var(--vlaina-shadow-panel-soft)] max-[640px]:p-4">
      <div className="space-y-4 text-[var(--vlaina-font-sm)] leading-7 text-[var(--vlaina-sidebar-notes-text)]">
        <p className="text-[var(--vlaina-font-h4)] font-semibold leading-8 text-[var(--vlaina-sidebar-notes-text)]">
          {noteText('settings.about.note.intro')}
        </p>
        <p>{t('settings.about.note.curiousTitle')}</p>
        <ol className="list-decimal space-y-2 pl-5 text-[var(--vlaina-font-sm)] leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          <li><strong>{t('settings.about.note.curiousMissing')}</strong></li>
          <li><strong>{t('settings.about.note.curiousRough')}</strong></li>
          <li><strong>{t('settings.about.note.curiousPaid')}</strong></li>
        </ol>
        <p>{t('settings.about.note.originStory')}</p>
        <p>{noteText('settings.about.note.migrationStory', { catimeSize: '200 KB', catimeStars: '4,000', targetSize: '20 MB' })}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.releaseHeading')}
        </h2>
        <p>{noteText('settings.about.note.releaseReason')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.donationHeading')}
        </h2>
        <p>{t('settings.about.note.donationReason')}</p>
        <p>{noteText('settings.about.note.catimeStory', { catimeStars: '4,000' })}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.earnHeading')}
        </h2>
        <p>{noteText('settings.about.note.catimeIncome', { catimeIncome })}</p>
        <p>{t('settings.about.note.graduated')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.jobHeading')}
        </h2>
        <p>{noteText('settings.about.note.jobStory')}</p>
        <p>{noteText('settings.about.note.afterWorkStory')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.weekendHeading')}
        </h2>
        <p>{t('settings.about.note.weekendStory')}</p>
        <p>{t('settings.about.note.resignationStory')}</p>
        <h3 className="text-[var(--vlaina-font-sm)] font-semibold leading-6 text-[var(--vlaina-sidebar-notes-text)]">
          {t('settings.about.note.resignationQuoteHeading')}
        </h3>
        <div className="rounded-[var(--vlaina-radius-18px)] border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-panel-muted)] px-4 py-3 text-[var(--vlaina-font-13)] leading-6 text-[var(--vlaina-sidebar-notes-text-soft)]">
          <p className="mt-3 whitespace-pre-wrap">
            {noteText('settings.about.note.resignationQuote')}
          </p>
        </div>
        <p>{t('settings.about.note.newProject')}</p>
        <h2 className="text-[var(--vlaina-font-base)] font-semibold leading-7 text-[var(--vlaina-sidebar-notes-text)]">
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
    <div className="space-y-8" data-settings-tab-panel="about">
      <div className="flex min-w-0 items-center gap-7 py-2 max-[640px]:gap-4">
        <img
          src={appLogoUrl}
          alt="vlaina"
          className="h-32 w-32 shrink-0 rounded-[var(--vlaina-radius-28px)] object-contain max-[640px]:h-20 max-[640px]:w-20 max-[640px]:rounded-[var(--vlaina-radius-20px)]"
          draggable={false}
        />
        <div className="min-w-0 pt-1">
          <a
            {...getExternalLinkProps('https://vlaina.com')}
            className="inline-block max-w-full truncate text-[var(--vlaina-font-h4)] font-semibold leading-7 text-[var(--vlaina-accent)]"
          >
            vlaina
          </a>
          <div className="mt-1 truncate text-[var(--vlaina-font-13)] font-normal leading-5 text-[var(--vlaina-sidebar-notes-text-soft)] tabular-nums">
            {currentVersion || APP_VERSION}
          </div>
        </div>
      </div>

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
              className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] px-4 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] transition-colors hover:bg-[var(--vlaina-hover-filled)] disabled:cursor-not-allowed disabled:opacity-[var(--vlaina-opacity-60)]"
            >
              <RefreshCw size={themeIconTokens.sizeSidebar} className={cn(status === 'checking' && 'animate-spin')} />
              {t('common.check')}
            </button>
            {hasUpdate ? (
              <button
                type="button"
                onClick={openUpdateDownload}
                title={updateInfo?.platformAssetName || undefined}
                className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full bg-[var(--vlaina-accent)] px-4 text-[var(--vlaina-font-13)] font-semibold text-[var(--vlaina-color-white)] transition-colors hover:bg-[var(--vlaina-accent-hover)]"
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
        <SettingsSectionHeader>{t('settings.about.privacy')}</SettingsSectionHeader>
        <SettingsItem title={t('settings.about.openPrivacyPolicy')} className="hover:!shadow-[var(--vlaina-shadow-raised-soft)]">
          <button
            type="button"
            onClick={() => void openExternalHref(privacyPolicyUrl)}
            className="inline-flex h-10 min-w-0 items-center gap-2 rounded-full border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] px-4 text-[var(--vlaina-font-13)] font-medium text-[var(--vlaina-sidebar-notes-text)] transition-colors hover:bg-[var(--vlaina-hover-filled)]"
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
