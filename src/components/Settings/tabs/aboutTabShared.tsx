import type { ReactNode } from 'react';
import { getExternalLinkProps } from '@/lib/navigation/externalLinks';
import type { AppLanguage, MessageKey, MessageValues } from '@/lib/i18n';

export const privacyPolicyUrl = 'https://github.com/vladelaina/vlaina/blob/main/PRIVACY.md';
export const officialWebsiteUrl = 'https://vlaina.com';
export const officialWebsiteLabel = 'vlaina.com';
export const githubRepositoryUrl = 'https://github.com/vladelaina/vlaina';
export const discordInviteUrl = 'https://vlaina.com/r/discord';
export const slackInviteUrl = 'https://vlaina.com/r/slack';
export const supportEmail = 'hi@vlaina.com';
export const supportEmailHref = `mailto:${supportEmail}`;
export const appLogoUrl = `${import.meta.env.BASE_URL}logo.png`;

export const communityPillClassName =
  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[var(--vlaina-font-xs)] font-semibold text-[var(--vlaina-sidebar-notes-text)] transition-all duration-[var(--vlaina-duration-200)]';
export const aboutHeroBadgeClassName =
  'inline-flex shrink-0 items-center whitespace-nowrap rounded-[var(--vlaina-radius-pill)] border border-[var(--vlaina-color-panel-border)] bg-[var(--vlaina-color-panel-glass)] px-4 py-2 font-mono text-[var(--vlaina-font-xs)] font-extrabold tracking-[var(--vlaina-tracking-widest-default)] text-[var(--vlaina-color-text-strong)] shadow-[var(--vlaina-shadow-sm)] backdrop-blur-[var(--vlaina-backdrop-blur-sm)] transition-all duration-[var(--vlaina-duration-200)] hover:border-[var(--vlaina-color-accent-border-hover)] max-[640px]:px-3';
export const aboutHeroRuleClassName = 'h-px w-[var(--vlaina-size-48px)] opacity-[var(--vlaina-opacity-30)] max-[640px]:hidden';
export const aboutHeroLogoRadiusClassName =
  'rounded-[var(--vlaina-radius-36px)] max-[640px]:rounded-[var(--vlaina-radius-28px)]';

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

function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="text-[var(--vlaina-accent)]" {...getExternalLinkProps(href)}>
      {children}
    </a>
  );
}

export function formatCnyEquivalent(language: AppLanguage, cnyAmount: number): string {
  const equivalent = cnyEquivalentByLanguage[language] ?? cnyEquivalentByLanguage.en;
  const amount = cnyAmount === 3000 ? equivalent.amount : Math.round((equivalent.amount / 3000) * cnyAmount);

  return new Intl.NumberFormat(equivalent.locale, {
    style: 'currency',
    currency: equivalent.currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

export function renderRichText(text: string): ReactNode[] {
  const tokens: Record<string, ReactNode> = {
    '{appSite}': <ExternalTextLink href={officialWebsiteUrl}>vlaina</ExternalTextLink>,
    '{catimeSite}': <ExternalTextLink href="https://cati.me">Catime</ExternalTextLink>,
    '{authorSite}': <ExternalTextLink href="https://vladelaina.com">vladelaina</ExternalTextLink>,
    '{clockTopic}': <ExternalTextLink href="https://github.com/topics/clock">Topics clock</ExternalTextLink>,
  };

  return text.split(richTokenPattern).map((part, index) => (
    <span key={`${part}-${index}`}>{tokens[part] ?? part}</span>
  ));
}

export type AboutNoteTextFormatter = (key: MessageKey, values?: MessageValues) => ReactNode[];
