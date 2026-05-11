import type { AppLanguage } from './languages';
import { englishMessages } from './locales/en';
import zhCNMessagesJson from './locales/zh-CN.json';
import zhHantMessagesJson from './locales/zh-Hant.json';
import jaMessagesJson from './locales/ja.json';
import koMessagesJson from './locales/ko.json';
import frMessagesJson from './locales/fr.json';
import deMessagesJson from './locales/de.json';
import esMessagesJson from './locales/es.json';
import ptBRMessagesJson from './locales/pt-BR.json';
import itMessagesJson from './locales/it.json';
import ruMessagesJson from './locales/ru.json';
import trMessagesJson from './locales/tr.json';
import viMessagesJson from './locales/vi.json';
import idMessagesJson from './locales/id.json';
import thMessagesJson from './locales/th.json';
import { messageKeys, type MessageKey, type Messages, type MessageValues } from './schema';

export { messageKeys, type MessageKey, type Messages, type MessageValues };

type LocalizedAppLanguage = Exclude<AppLanguage, 'en'>;

export const localizedMessages = {
  'zh-CN': zhCNMessagesJson,
  'zh-Hant': zhHantMessagesJson,
  'ja': jaMessagesJson,
  'ko': koMessagesJson,
  'fr': frMessagesJson,
  'de': deMessagesJson,
  'es': esMessagesJson,
  'pt-BR': ptBRMessagesJson,
  'it': itMessagesJson,
  'ru': ruMessagesJson,
  'tr': trMessagesJson,
  'vi': viMessagesJson,
  'id': idMessagesJson,
  'th': thMessagesJson,
} satisfies Record<LocalizedAppLanguage, Messages>;

export function getMessages(language: AppLanguage): Messages {
  if (language === 'en') return englishMessages;
  return localizedMessages[language] ?? englishMessages;
}

export function formatMessage(
  message: string,
  values: MessageValues | undefined
): string {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}
