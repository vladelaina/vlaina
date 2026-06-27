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
      'settings.about.github',
      'settings.about.discord',
      'settings.about.slack',
      'vault.pathPlaceholder',
      'icon.emoji',
    ]);

    for (const key of messageKeys) {
      if (stableProductKeys.has(key)) continue;
      expect(simplifiedChineseMessages[key], key).not.toBe(englishMessages[key]);
    }
  });

  it('uses canonical Chinese list labels for editor block types', () => {
    expect(getMessages('zh-CN')).toMatchObject({
      'editor.blockType.taskList': '待办',
      'editor.blockType.bulletList': '无序列表',
      'editor.blockType.orderedList': '有序列表',
    });
    expect(getMessages('zh-Hant')).toMatchObject({
      'editor.blockType.taskList': '待辦',
      'editor.blockType.bulletList': '無序列表',
      'editor.blockType.orderedList': '有序列表',
    });
  });

  it('keeps recently added editor action labels localized outside English', () => {
    const englishMessages = getMessages('en');
    const editorActionKeys = [
      'editor.mathPlaceholder',
      'editor.mermaidPlaceholder',
      'editor.htmlBlockPlaceholder',
      'editor.insertImage',
      'editor.videoUrlPlaceholder',
      'editor.videoUrlHint',
      'editor.align',
    ] as const;

    for (const language of APP_LANGUAGES) {
      if (language.code === 'en') continue;
      const messages = getMessages(language.code);
      for (const key of editorActionKeys) {
        expect(messages[key], `${language.code}:${key}`).not.toBe(englishMessages[key]);
      }
    }
  });

  it('uses Traditional Chinese for editor action labels', () => {
    expect(getMessages('zh-Hant')).toMatchObject({
      'editor.changeCalloutIcon': '更換標註圖示',
      'editor.images': '圖片',
      'editor.align': '對齊',
    });
  });

  it('uses sign-in copy for email-code submit buttons', () => {
    const expectedVerifyCodeLabels = {
      en: 'Verify and Sign In',
      'zh-CN': '验证并登录',
      'zh-Hant': '驗證並登入',
      ja: '認証してログイン',
      ko: '인증하고 로그인',
      fr: 'Vérifier et se connecter',
      de: 'Bestätigen und anmelden',
      es: 'Verificar e iniciar sesión',
      'pt-BR': 'Verificar e entrar',
      it: 'Verifica e accedi',
      ru: 'Подтвердить и войти',
      tr: 'Doğrula ve giriş yap',
      vi: 'Xác minh và đăng nhập',
      id: 'Verifikasi dan masuk',
      th: 'ยืนยันและเข้าสู่ระบบ',
    } as const;

    for (const language of APP_LANGUAGES) {
      expect(getMessages(language.code)['account.verifyCode'], language.code).toBe(
        expectedVerifyCodeLabels[language.code]
      );
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
