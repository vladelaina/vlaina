import { describe, expect, it } from 'vitest';
import {
  isAppLanguagePreference,
  normalizeAppLanguagePreference,
  resolveSystemLanguage,
} from './languages';

describe('i18n languages', () => {
  it('resolves supported exact browser language tags', () => {
    expect(resolveSystemLanguage(['fr-FR', 'en-US'])).toBe('fr');
    expect(resolveSystemLanguage(['pt-PT', 'en-US'])).toBe('pt-BR');
  });

  it('maps Chinese regional tags to simplified or traditional Chinese', () => {
    expect(resolveSystemLanguage(['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveSystemLanguage(['zh-Hant'])).toBe('zh-Hant');
    expect(resolveSystemLanguage(['zh-TW'])).toBe('zh-Hant');
    expect(resolveSystemLanguage(['zh-HK'])).toBe('zh-Hant');
  });

  it('falls back to English when no supported system language is available', () => {
    expect(resolveSystemLanguage(['nl-NL'])).toBe('en');
    expect(resolveSystemLanguage([])).toBe('en');
  });

  it('accepts only system or supported app languages as preferences', () => {
    expect(isAppLanguagePreference('system')).toBe(true);
    expect(isAppLanguagePreference('zh-Hant')).toBe(true);
    expect(isAppLanguagePreference('ja')).toBe(true);
    expect(isAppLanguagePreference('nl')).toBe(false);
  });

  it('normalizes the previous traditional Chinese preference code', () => {
    expect(normalizeAppLanguagePreference('zh-TW')).toBe('zh-Hant');
    expect(normalizeAppLanguagePreference('zh-tw')).toBe('zh-Hant');
  });
});
