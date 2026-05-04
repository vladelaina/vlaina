import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES } from './languages';
import { getMessages, messageKeys } from './messages';

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
});
