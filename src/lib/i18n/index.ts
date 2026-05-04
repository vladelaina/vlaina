export {
  APP_LANGUAGES,
  DEFAULT_APP_LANGUAGE,
  SYSTEM_LANGUAGE_PREFERENCE,
  getEffectiveAppLanguage,
  isAppLanguage,
  isAppLanguagePreference,
  normalizeAppLanguagePreference,
  resolveSystemLanguage,
  type AppLanguage,
  type AppLanguagePreference,
  type LanguageOption,
} from './languages';
export { getMessages, type MessageKey, type Messages } from './messages';
export { useDocumentLanguage, useI18n } from './useI18n';
