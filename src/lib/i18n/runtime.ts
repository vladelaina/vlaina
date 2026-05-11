import { useUIStore } from '@/stores/uiSlice';
import { getEffectiveAppLanguage } from './languages';
import { formatMessage, getMessages, type MessageKey, type MessageValues } from './messages';

export function translate(key: MessageKey, values?: MessageValues): string {
  const language = getEffectiveAppLanguage(useUIStore.getState().languagePreference);
  return formatMessage(getMessages(language)[key], values);
}
