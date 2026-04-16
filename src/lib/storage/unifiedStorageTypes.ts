import type { TimeView } from '@/lib/date';
import type { Provider, AIModel, ChatMessage, ChatSession, ProviderBenchmarkRecord } from '@/lib/ai/types';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_VIEW_MODE,
  DEFAULT_DAY_COUNT,
} from '@/lib/config';

export interface UnifiedProgress {
  id: string;
  type: 'progress' | 'counter';
  title: string;
  tags?: string[];
  icon?: string;
  direction?: 'increment' | 'decrement';
  total?: number;
  step: number;
  unit: string;
  current: number;
  todayCount: number;
  lastUpdateDate?: string;
  history?: Record<string, number>;
  frequency?: 'daily' | 'weekly' | 'monthly';
  resetFrequency?: 'daily' | 'weekly' | 'monthly' | 'none';
  createdAt: number;
  archived?: boolean;
}

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
  progress: UnifiedProgress[];
  settings: {
    timezone: TimezoneInfo;
    viewMode: TimeView;
    dayCount: number;
    hourHeight?: number;
    use24Hour?: boolean;
    dayStartTime?: number;
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
    unreadSessionIds?: string[];
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
    progress: [],
    settings: {
      timezone: { offset: DEFAULT_TIMEZONE, city: 'Beijing' },
      viewMode: DEFAULT_VIEW_MODE,
      dayCount: DEFAULT_DAY_COUNT,
      markdown: {
        codeBlock: {
          showLineNumbers: true,
        },
      },
    },
  };
}
