import { useCallback, useEffect, useMemo } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import {
  getEffectiveAppLanguage,
  SYSTEM_LANGUAGE_PREFERENCE,
  type AppLanguage,
  type AppLanguagePreference,
} from './languages';
import { getMessages, type MessageKey } from './messages';

export function useI18n() {
  const languagePreference = useUIStore((state) => state.languagePreference);
  const setLanguagePreference = useUIStore((state) => state.setLanguagePreference);
  const language = getEffectiveAppLanguage(languagePreference);
  const messages = useMemo(() => getMessages(language), [language]);
  const t = useCallback((key: MessageKey) => messages[key], [messages]);

  return {
    language,
    languagePreference,
    setLanguagePreference,
    t,
  };
}

export function useDocumentLanguage(language: AppLanguage) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);
}

export function isSystemLanguagePreference(preference: AppLanguagePreference): boolean {
  return preference === SYSTEM_LANGUAGE_PREFERENCE;
}
