export type AppLanguage =
  | 'en'
  | 'zh-CN'
  | 'zh-Hant'
  | 'ja'
  | 'ko'
  | 'fr'
  | 'de'
  | 'es'
  | 'pt-BR'
  | 'it'
  | 'ru'
  | 'tr'
  | 'vi'
  | 'id'
  | 'th';

export type AppLanguagePreference = 'system' | AppLanguage;

export interface LanguageOption {
  code: AppLanguage;
  nativeName: string;
}

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en';
export const SYSTEM_LANGUAGE_PREFERENCE = 'system';

export const APP_LANGUAGES: LanguageOption[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'zh-CN', nativeName: '简体中文' },
  { code: 'zh-Hant', nativeName: '繁體中文' },
  { code: 'ja', nativeName: '日本語' },
  { code: 'ko', nativeName: '한국어' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'de', nativeName: 'Deutsch' },
  { code: 'es', nativeName: 'Español' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)' },
  { code: 'it', nativeName: 'Italiano' },
  { code: 'ru', nativeName: 'Русский' },
  { code: 'tr', nativeName: 'Türkçe' },
  { code: 'vi', nativeName: 'Tiếng Việt' },
  { code: 'id', nativeName: 'Bahasa Indonesia' },
  { code: 'th', nativeName: 'ไทย' },
];

const LANGUAGE_CODES = new Set<AppLanguage>(APP_LANGUAGES.map((language) => language.code));
const BASE_LANGUAGE_MAP: Record<string, AppLanguage> = {
  en: 'en',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  pt: 'pt-BR',
  it: 'it',
  ru: 'ru',
  tr: 'tr',
  vi: 'vi',
  id: 'id',
  th: 'th',
};

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return LANGUAGE_CODES.has(value as AppLanguage);
}

export function normalizeAppLanguagePreference(
  value: string | null | undefined
): AppLanguagePreference | null {
  if (value?.toLowerCase() === 'zh-tw') return 'zh-Hant';
  return isAppLanguagePreference(value) ? value : null;
}

export function isAppLanguagePreference(value: string | null | undefined): value is AppLanguagePreference {
  return value === SYSTEM_LANGUAGE_PREFERENCE || isAppLanguage(value);
}

export function resolveSystemLanguage(languages: readonly string[] | undefined): AppLanguage {
  for (const language of languages ?? []) {
    const normalized = normalizeLanguageTag(language);
    if (!normalized) continue;
    if (isAppLanguage(normalized)) return normalized;
    const baseLanguage = BASE_LANGUAGE_MAP[normalized.split('-')[0]];
    if (baseLanguage) return baseLanguage;
  }
  return DEFAULT_APP_LANGUAGE;
}

export function getBrowserLanguages(): string[] {
  if (typeof navigator === 'undefined') return [];
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return [...navigator.languages];
  }
  return navigator.language ? [navigator.language] : [];
}

export function getEffectiveAppLanguage(preference: AppLanguagePreference): AppLanguage {
  return preference === SYSTEM_LANGUAGE_PREFERENCE
    ? resolveSystemLanguage(getBrowserLanguages())
    : preference;
}

function normalizeLanguageTag(language: string): string {
  const [base = '', region = ''] = language.trim().replace('_', '-').split('-');
  if (!base) return '';
  if (base.toLowerCase() === 'zh') {
    const normalizedRegion = region.toUpperCase();
    return normalizedRegion === 'TW'
      || normalizedRegion === 'HK'
      || normalizedRegion === 'MO'
      || region.toLowerCase() === 'hant'
      ? 'zh-Hant'
      : 'zh-CN';
  }
  if (base.toLowerCase() === 'pt') {
    return 'pt-BR';
  }
  return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
}
