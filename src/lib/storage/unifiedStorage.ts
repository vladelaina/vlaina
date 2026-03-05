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

import type { Provider, AIModel, ChatMessage, ChatSession } from '@/lib/ai/types';
import { isTemporarySession } from '@/lib/ai/temporaryChat';

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
    temporaryChatEnabled?: boolean;
    nativeWebSearchEnabled?: boolean;
    customSystemPrompt?: string;
    includeTimeContext?: boolean;
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
    calendars: [{ id: 'main', name: 'Main', color: 'blue', visible: true }],
    progress: [],
    settings: {
      timezone: { offset: DEFAULT_TIMEZONE, city: 'Beijing' },
      viewMode: DEFAULT_VIEW_MODE,
      dayCount: DEFAULT_DAY_COUNT,
    },
  };
}

export async function loadUnifiedData(): Promise<UnifiedData> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const mainPath = await joinPath(base, '.nekotick', 'data.json');
    const sessionsPath = await joinPath(base, '.nekotick', 'chat', 'sessions.json');
    const channelsDir = await joinPath(base, '.nekotick', 'chat', 'channels');

    let combinedData = getDefaultData();

    // 1. Load Main Data
    if (await storage.exists(mainPath)) {
      const content = await storage.readFile(mainPath);
      const parsed = JSON.parse(content) as DataFile;
      if (parsed.version === 2 && parsed.data) {
        combinedData = { ...combinedData, ...parsed.data };
      }
    }

    // Init AI State
    combinedData.ai = {
        providers: [],
        models: [],
        sessions: [],
        selectedModelId: null,
        currentSessionId: null,
        temporaryChatEnabled: false,
        nativeWebSearchEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
        messages: {}
    };

    // 2. Load Sessions Index
    let providerIds: string[] = [];
    if (await storage.exists(sessionsPath)) {
        try {
            const sessionsData = JSON.parse(await storage.readFile(sessionsPath));
            const loadedSessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];
            combinedData.ai.sessions = loadedSessions.filter((session: ChatSession) => !isTemporarySession(session));
            combinedData.ai.selectedModelId = sessionsData.selectedModelId || null;
            const currentSessionId = sessionsData.currentSessionId || null;
            const hasCurrentSession = currentSessionId
              ? combinedData.ai.sessions.some((session) => session.id === currentSessionId)
              : false;
            combinedData.ai.currentSessionId = hasCurrentSession ? currentSessionId : null;
            combinedData.ai.temporaryChatEnabled = !!sessionsData.temporaryChatEnabled;
            combinedData.ai.nativeWebSearchEnabled = sessionsData.nativeWebSearchEnabled || false;
            combinedData.ai.customSystemPrompt = typeof sessionsData.customSystemPrompt === 'string' ? sessionsData.customSystemPrompt : '';
            combinedData.ai.includeTimeContext = sessionsData.includeTimeContext !== false;
            providerIds = sessionsData.providerIds || []; // Index of channels
        } catch (e) { console.error('Failed to load sessions.json', e); }
    }

    // 3. Load Individual Channels
    if (providerIds.length > 0) {
        const providerPromises = providerIds.map(async (id) => {
            const pPath = await joinPath(channelsDir, `${id}.json`);
            if (await storage.exists(pPath)) {
                try {
                    const pData = JSON.parse(await storage.readFile(pPath));
                    return pData; // Expected: { provider: Provider, models: AIModel[] }
                } catch (e) { return null; }
            }
            return null;
        });

        const loadedProviders = await Promise.all(providerPromises);
        loadedProviders.forEach(p => {
            if (p && p.provider) {
                combinedData.ai!.providers.push(p.provider);
                if (p.models) {
                    combinedData.ai!.models.push(...p.models);
                }
            }
        });
    }

    return combinedData;
  } catch (error) {
    return getDefaultData();
  }
}

async function performSplitSave(data: UnifiedData) {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    
    const dotNeko = await joinPath(base, '.nekotick');
    const chatDir = await joinPath(dotNeko, 'chat');
    const channelsDir = await joinPath(chatDir, 'channels');
    
    const mainPath = await joinPath(dotNeko, 'data.json');
    const sessionsPath = await joinPath(chatDir, 'sessions.json');

    if (!(await storage.exists(channelsDir))) {
        await storage.mkdir(channelsDir, true);
    }

    const { ai, ...mainPart } = data;
    
    // 1. Save Main
    const mainFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: mainPart as UnifiedData
    };
    await storage.writeFile(mainPath, JSON.stringify(mainFile, null, 2));

    // 2. Save AI Data
    if (ai) {
        const persistedSessions = ai.sessions.filter((session) => !isTemporarySession(session));
        const persistedSessionIds = new Set(persistedSessions.map((session) => session.id));
        const activeProviderIds = new Set(ai.providers.map((provider) => provider.id));

        // Save Sessions Index + Provider IDs
        const sessionsData = {
            sessions: persistedSessions,
            selectedModelId: ai.selectedModelId,
            currentSessionId: ai.currentSessionId && persistedSessionIds.has(ai.currentSessionId)
              ? ai.currentSessionId
              : null,
            temporaryChatEnabled: !!ai.temporaryChatEnabled,
            nativeWebSearchEnabled: ai.nativeWebSearchEnabled,
            customSystemPrompt: ai.customSystemPrompt || '',
            includeTimeContext: ai.includeTimeContext !== false,
            providerIds: ai.providers.map(p => p.id)
        };
        await storage.writeFile(sessionsPath, JSON.stringify(sessionsData, null, 2));

        // Save Each Provider to its own file
        for (const provider of ai.providers) {
            const pModels = ai.models.filter(m => m.providerId === provider.id);
            const pData = {
                provider,
                models: pModels
            };
            const pPath = await joinPath(channelsDir, `${provider.id}.json`);
            await storage.writeFile(pPath, JSON.stringify(pData, null, 2));
        }

        const channelEntries = await storage.listDir(channelsDir).catch(() => []);
        for (const entry of channelEntries) {
            if (!entry.isFile || !entry.name.endsWith('.json')) {
                continue;
            }
            const providerId = entry.name.slice(0, -5);
            if (activeProviderIds.has(providerId)) {
                continue;
            }
            try {
                await storage.deleteFile(entry.path);
            } catch (error) {
                console.warn('[Storage] failed to cleanup stale provider channel file:', entry.path, error);
            }
        }
    }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingData: UnifiedData | null = null;

export async function saveUnifiedData(data: UnifiedData): Promise<void> {
  pendingData = data;
  if (saveTimeout) clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    if (!pendingData) return;
    try {
      await performSplitSave(pendingData);
      pendingData = null;
      triggerAutoSyncIfEligible();
    } catch (error) {
      console.error('[Storage] save failed:', error);
    }
  }, 300);
}

export async function flushPendingSave(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (pendingData) {
    const data = pendingData;
    pendingData = null;
    try {
      await performSplitSave(data);
    } catch (error) {
      console.error('[Storage] flush save failed:', error);
    }
  }
}

export async function saveUnifiedDataImmediate(data: UnifiedData): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  pendingData = null;
  try {
    await performSplitSave(data);
  } catch (error) {
    console.error('[Storage] immediate save failed:', error);
  }
}

function triggerAutoSyncIfEligible(): void {
  const syncState = useGithubSyncStore.getState();
  const proStatusState = useProStatusStore.getState();
  if (syncState.isConnected && proStatusState.isProUser) {
    getAutoSyncManager().triggerSync();
  }
}
