import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { getAutoSyncManager } from '@/lib/sync/autoSyncManager';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useProStatusStore } from '@/stores/useProStatusStore';
import type { TimeView } from '@/lib/date';
import type { NekoCalendar } from '@/lib/ics/types';
import {
  DEFAULT_TIMEZONE,
  DEFAULT_VIEW_MODE,
  DEFAULT_DAY_COUNT,
} from '@/lib/config';

export interface UnifiedProgress {
  id: string;
  type: 'progress' | 'counter';
  title: string;
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

import type { Provider, AIModel, ChatMessage, ChatSession } from '@/lib/ai/types';

export interface TimezoneInfo {
  offset: number;
  city: string;
}

export interface UnifiedData {
  calendars: NekoCalendar[];
  progress: UnifiedProgress[];
  settings: {
    timezone: TimezoneInfo;
    viewMode: TimeView;
    dayCount: number;
    hourHeight?: number;
    use24Hour?: boolean;
    dayStartTime?: number;
  };
  customIcons?: CustomIcon[];
  ai?: {
    providers: Provider[];
    models: AIModel[];
    sessions: ChatSession[];
    messages: Record<string, ChatMessage[]>;
    selectedModelId: string | null;
    currentSessionId: string | null;
    webSearchEnabled?: boolean;
  };
}

interface DataFile {
  version: 2;
  lastModified: number;
  data: UnifiedData;
}

let basePath: string | null = null;

async function getBasePath(): Promise<string> {
  if (basePath === null) {
    const storage = getStorageAdapter();
    const appData = await storage.getBasePath();
    basePath =
      appData.endsWith(String.fromCharCode(92)) || appData.endsWith('/') ? appData.slice(0, -1) : appData;
  }
  return basePath;
}

function getDefaultData(): UnifiedData {
  return {
    calendars: [
      {
        id: 'main',
        name: 'Main',
        color: 'blue',
        visible: true,
      }
    ],
    progress: [],
    settings: {
      timezone: {
        offset: DEFAULT_TIMEZONE,
        city: 'Beijing', // 默认城市
      },
      viewMode: DEFAULT_VIEW_MODE,
      dayCount: DEFAULT_DAY_COUNT,
    },
  };
}

export async function loadUnifiedData(): Promise<UnifiedData> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const jsonPath = await joinPath(base, '.nekotick', 'data.json');

    if (await storage.exists(jsonPath)) {
      const content = await storage.readFile(jsonPath);
      const parsed = JSON.parse(content) as DataFile;

      if (parsed.version === 2 && parsed.data) {
        if (!parsed.data.calendars || parsed.data.calendars.length === 0) {
            parsed.data.calendars = getDefaultData().calendars;
        }
        return parsed.data;
      }
    }

    return getDefaultData();
  } catch (error) {
    return getDefaultData();
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingData: UnifiedData | null = null;

export async function saveUnifiedData(data: UnifiedData): Promise<void> {
  pendingData = data;

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    if (!pendingData) return;

    try {
      const storage = getStorageAdapter();
      const base = await getBasePath();
      const jsonPath = await joinPath(base, '.nekotick', 'data.json');

      const dataFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: pendingData,
      };
      await storage.writeFile(jsonPath, JSON.stringify(dataFile, null, 2));

      pendingData = null;

      triggerAutoSyncIfEligible();
    } catch (error) {
    }
  }, 300);
}

function triggerAutoSyncIfEligible(): void {
  const syncState = useGithubSyncStore.getState();
  const proStatusState = useProStatusStore.getState();

  if (syncState.isConnected && proStatusState.isProUser) {
    const autoSyncManager = getAutoSyncManager();
    autoSyncManager.triggerSync();
  }
}

export async function saveUnifiedDataImmediate(data: UnifiedData): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingData = null;

  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const jsonPath = await joinPath(base, '.nekotick', 'data.json');

    const dataFile: DataFile = {
      version: 2,
      lastModified: Date.now(),
      data,
    };
    await storage.writeFile(jsonPath, JSON.stringify(dataFile, null, 2));

  } catch (error) {
  }
}