import newapiIcon from '@/components/Chat/assets/providers/newapi.png';

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  defaultBaseUrl: string;
  description?: string;
}

export const SUPPORTED_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    icon: newapiIcon, // Keep one generic icon
    defaultBaseUrl: '',
    description: 'Connect to any OpenAI-compatible API',
  }
];