import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUIStore } from '@/stores/uiSlice';
import {
  getEffectiveAppLanguage,
  SYSTEM_LANGUAGE_PREFERENCE,
  type AppLanguage,
} from './languages';
import { getMessages, type MessageKey } from './messages';

export function useI18n() {
  const languagePreference = useUIStore((state) => state.languagePreference);
  const setLanguagePreference = useUIStore((state) => state.setLanguagePreference);
  const [, setSystemLanguageVersion] = useState(0);
  const language = getEffectiveAppLanguage(languagePreference);
  const messages = useMemo(() => getMessages(language), [language]);
  const t = useCallback((key: MessageKey) => messages[key], [messages]);

  useEffect(() => {
    if (languagePreference !== SYSTEM_LANGUAGE_PREFERENCE || typeof window === 'undefined') return;
    const handleLanguageChange = () => setSystemLanguageVersion((version) => version + 1);
    window.addEventListener('languagechange', handleLanguageChange);
    return () => window.removeEventListener('languagechange', handleLanguageChange);
  }, [languagePreference]);

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
