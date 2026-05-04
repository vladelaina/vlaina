import { describe, expect, it } from 'vitest';
import {
  isAppLanguagePreference,
  resolveSystemLanguage,
} from './languages';

describe('i18n languages', () => {
  it('resolves supported exact browser language tags', () => {
    expect(resolveSystemLanguage(['fr-FR', 'en-US'])).toBe('fr');
    expect(resolveSystemLanguage(['pt-PT', 'en-US'])).toBe('pt-BR');
  });

  it('maps Chinese regional tags to simplified or traditional Chinese', () => {
    expect(resolveSystemLanguage(['zh-Hans-CN'])).toBe('zh-CN');
    expect(resolveSystemLanguage(['zh-TW'])).toBe('zh-TW');
    expect(resolveSystemLanguage(['zh-HK'])).toBe('zh-TW');
  });

  it('falls back to English when no supported system language is available', () => {
    expect(resolveSystemLanguage(['nl-NL'])).toBe('en');
    expect(resolveSystemLanguage([])).toBe('en');
  });

  it('accepts only system or supported app languages as preferences', () => {
    expect(isAppLanguagePreference('system')).toBe(true);
    expect(isAppLanguagePreference('ja')).toBe(true);
    expect(isAppLanguagePreference('nl')).toBe(false);
  });
});
