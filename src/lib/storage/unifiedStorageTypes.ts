import type { Provider, AIModel, ChatMessage, ChatSession, ProviderBenchmarkRecord } from '@/lib/ai/types';
import { DEFAULT_TIMEZONE } from '@/lib/config';

export interface CustomIcon {
  id: string;
  url: string;
  name: string;
  createdAt: number;
}

export interface TimezoneInfo {
  offset: number;
  city: string;
}

export interface UnifiedData {
  settings: {
    timezone: TimezoneInfo;
    markdown: {
      codeBlock: {
        showLineNumbers: boolean;
      };
    };
  };
  customIcons?: CustomIcon[];
  ai?: {
    providers: Provider[];
    models: AIModel[];
    benchmarkResults?: Record<string, ProviderBenchmarkRecord>;
    fetchedModels?: Record<string, string[]>;
    sessions: ChatSession[];
    messages: Record<string, ChatMessage[]>;
    selectedModelId: string | null;
    currentSessionId: string | null;
    temporaryChatEnabled?: boolean;
    customSystemPrompt?: string;
    includeTimeContext?: boolean;
  };
}

export interface DataFile {
  version: 2;
  lastModified: number;
  data: UnifiedData;
}

export function createDefaultUnifiedData(): UnifiedData {
  return {
    settings: {
      timezone: { offset: DEFAULT_TIMEZONE, city: 'Beijing' },
      markdown: {
        codeBlock: {
          showLineNumbers: true,
        },
      },
    },
    customIcons: [],
  };
}
