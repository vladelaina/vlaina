import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES } from './languages';
import { getMessages, localizedMessages, messageKeys } from './messages';

describe('i18n messages', () => {
  it('provides every menu message for each supported app language', () => {
    for (const language of APP_LANGUAGES) {
      const messages = getMessages(language.code);

      for (const key of messageKeys) {
        expect(messages[key], `${language.code}:${key}`).toEqual(expect.any(String));
        expect(messages[key].trim(), `${language.code}:${key}`).not.toBe('');
      }
    }
  });

  it('keeps simplified Chinese fully localized', () => {
    const englishMessages = getMessages('en');
    const simplifiedChineseMessages = getMessages('zh-CN');
    const stableProductKeys = new Set([
      'settings.tabs.ai',
      'settings.tabs.markdown',
      'settings.about.discord',
      'vault.pathPlaceholder',
      'icon.emoji',
    ]);

    for (const key of messageKeys) {
      if (stableProductKeys.has(key)) continue;
      expect(simplifiedChineseMessages[key], key).not.toBe(englishMessages[key]);
    }
  });

  it('keeps every localized language complete before English fallback can apply', () => {
    for (const language of APP_LANGUAGES) {
      if (language.code === 'en') continue;
      const messages = localizedMessages[language.code];

      expect(Object.keys(messages).sort(), language.code).toEqual([...messageKeys].sort());
      for (const key of messageKeys) {
        expect(messages[key], `${language.code}:${key}`).toEqual(expect.any(String));
        expect(messages[key].trim(), `${language.code}:${key}`).not.toBe('');
      }
    }
  });

  it('keeps interpolation placeholders identical across localized languages', () => {
    const englishMessages = getMessages('en');
    const getPlaceholders = (message: string) => [...message.matchAll(/\{\w+\}/g)].map(([value]) => value).sort();

    for (const language of APP_LANGUAGES) {
      if (language.code === 'en') continue;
      const messages = localizedMessages[language.code];

      for (const key of messageKeys) {
        expect(getPlaceholders(messages[key]), `${language.code}:${key}`).toEqual(
          getPlaceholders(englishMessages[key])
        );
      }
    }
  });
});
