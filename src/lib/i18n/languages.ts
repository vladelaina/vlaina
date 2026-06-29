interface AppLanguageDefinition {
  code: string;
  nativeName: string;
  baseLanguage?: string;
}

const APP_LANGUAGE_DEFINITIONS = [
  { code: 'en', nativeName: 'English', baseLanguage: 'en' },
  { code: 'zh-CN', nativeName: '简体中文', baseLanguage: 'zh' },
  { code: 'zh-Hant', nativeName: '繁體中文' },
  { code: 'ja', nativeName: '日本語', baseLanguage: 'ja' },
  { code: 'ko', nativeName: '한국어', baseLanguage: 'ko' },
  { code: 'fr', nativeName: 'Français', baseLanguage: 'fr' },
  { code: 'de', nativeName: 'Deutsch', baseLanguage: 'de' },
  { code: 'es', nativeName: 'Español', baseLanguage: 'es' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', baseLanguage: 'pt' },
  { code: 'it', nativeName: 'Italiano', baseLanguage: 'it' },
  { code: 'ru', nativeName: 'Русский', baseLanguage: 'ru' },
  { code: 'tr', nativeName: 'Türkçe', baseLanguage: 'tr' },
  { code: 'vi', nativeName: 'Tiếng Việt', baseLanguage: 'vi' },
  { code: 'id', nativeName: 'Bahasa Indonesia', baseLanguage: 'id' },
  { code: 'th', nativeName: 'ไทย', baseLanguage: 'th' },
] as const satisfies readonly AppLanguageDefinition[];

export type AppLanguage = typeof APP_LANGUAGE_DEFINITIONS[number]['code'];

export type AppLanguagePreference = 'system' | AppLanguage;

export interface LanguageOption {
  code: AppLanguage;
  nativeName: string;
}

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'en';
export const SYSTEM_LANGUAGE_PREFERENCE = 'system';

export const APP_LANGUAGES: LanguageOption[] = APP_LANGUAGE_DEFINITIONS.map((language) => ({
  code: language.code,
  nativeName: language.nativeName,
}));

const LANGUAGE_CODES = new Set<AppLanguage>(APP_LANGUAGES.map((language) => language.code));
const BASE_LANGUAGE_MAP = Object.fromEntries(
  APP_LANGUAGE_DEFINITIONS.flatMap((language) =>
    'baseLanguage' in language ? [[language.baseLanguage, language.code]] : []
  )
) as Record<string, AppLanguage>;

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
