import newapiIcon from '@/components/Chat/assets/providers/newapi.png';
import type { MessageKey } from '@/lib/i18n';

export interface ProviderConfig {
  id: string;
  name: string;
  nameKey?: MessageKey;
  icon: string;
  defaultBaseUrl: string;
  description?: string;
  descriptionKey?: MessageKey;
}

export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    nameKey: 'settings.ai.openaiCompatibleProvider',
    icon: newapiIcon, // Keep one generic icon
    defaultBaseUrl: '',
    descriptionKey: 'settings.ai.openaiCompatibleProviderDescription',
  }
];
