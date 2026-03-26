import { getStorageAdapter, isTauri, joinPath } from '@/lib/storage/adapter';
import { createPersistenceQueue } from './persistenceEngine';
import type { Provider } from '@/lib/ai/types';
import type { ChatSession } from '@/lib/ai/types';
import { isTemporarySession } from '@/lib/ai/temporaryChat';
import { getStorageBasePath } from './basePath';
import { normalizeLoadedAIModels } from './unifiedStorageAI';
import { aiProviderSecretCommands } from '@/lib/tauri/aiProviderSecretCommands';
import { useToastStore } from '@/stores/useToastStore';
import {
  createDefaultUnifiedData,
  type DataFile,
  type UnifiedData,
} from './unifiedStorageTypes';

export type {
  UnifiedProgress,
  CustomIcon,
  TimezoneInfo,
  UnifiedData,
} from './unifiedStorageTypes';

const MAIN_DATA_FILE = 'data.json';
const MAIN_DATA_BACKUP_FILE = 'data.backup.json';

let autoSyncTrigger: (() => void) | null = null;
let hasShownPersistenceFailureToast = false;
let hasShownSecretLoadFailureToast = false;

export function setUnifiedStorageAutoSyncTrigger(trigger: (() => void) | null): void {
  autoSyncTrigger = trigger;
}

async function getBasePath(): Promise<string> {
  return getStorageBasePath();
}

async function hydrateProvidersWithSecrets(
  providers: Provider[]
): Promise<Provider[]> {
  if (!isTauri() || providers.length === 0) {
    return providers;
  }

  let secretMap: Record<string, string> = {};
  try {
    secretMap = await aiProviderSecretCommands.getProviderSecrets(providers.map((provider) => provider.id));
    hasShownSecretLoadFailureToast = false;
  } catch (error) {
    console.error('[Storage] Failed to load AI provider secrets from system keychain:', error);
    if (!hasShownSecretLoadFailureToast) {
      hasShownSecretLoadFailureToast = true;
      useToastStore
        .getState()
        .addToast('Could not access your system keychain. Custom channel API keys may need to be re-entered.', 'error', 6000);
    }
  }

  return providers.map((provider) => {
      const storedSecret = secretMap[provider.id]?.trim() || '';
      return storedSecret ? { ...provider, apiKey: storedSecret } : { ...provider, apiKey: '' };
    });
}

function sanitizeProviderForDisk(provider: Provider): Provider {
  if (!isTauri()) {
    return provider;
  }

  if (!provider.apiKey) {
    return provider;
  }

  return {
    ...provider,
    apiKey: '',
  };
}

async function syncProviderSecrets(providers: Provider[]): Promise<void> {
  if (!isTauri()) {
    return;
  }

  await Promise.all(
    providers.map(async (provider) => {
      const apiKey = provider.apiKey?.trim() || '';
      if (apiKey) {
        await aiProviderSecretCommands.setProviderSecret(provider.id, apiKey);
      } else {
        await aiProviderSecretCommands.deleteProviderSecret(provider.id);
      }
    })
  );
}

export async function loadUnifiedData(): Promise<UnifiedData> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const configDir = await joinPath(base, '.vlaina');
    const chatDir = await joinPath(configDir, 'chat');
    const mainPath = await joinPath(configDir, MAIN_DATA_FILE);
    const mainBackupPath = await joinPath(configDir, MAIN_DATA_BACKUP_FILE);
    const sessionsPath = await joinPath(chatDir, 'sessions.json');
    const channelsDir = await joinPath(chatDir, 'channels');

    let combinedData = createDefaultUnifiedData();

    const loadMainDataFromPath = async (path: string): Promise<UnifiedData | null> => {
      if (!(await storage.exists(path))) {
        return null;
      }

      try {
        const content = await storage.readFile(path);
        const parsed = JSON.parse(content) as DataFile;
        if (parsed.version === 2 && parsed.data) {
          return parsed.data;
        }
        console.error('[Storage] Invalid unified data file version or shape:', path);
        return null;
      } catch (error) {
        console.error('[Storage] Failed to parse unified data file:', path, error);
        return null;
      }
    };

    const loadedMainData = await loadMainDataFromPath(mainPath);
    if (loadedMainData) {
      combinedData = { ...combinedData, ...loadedMainData };
    } else {
      const loadedBackupData = await loadMainDataFromPath(mainBackupPath);
      if (loadedBackupData) {
        console.warn('[Storage] Loaded unified data from backup file');
        combinedData = { ...combinedData, ...loadedBackupData };
      }
    }

    combinedData.ai = {
        providers: [],
        models: [],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [],
        selectedModelId: null,
        currentSessionId: null,
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
        messages: {}
    };

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
            combinedData.ai.temporaryChatEnabled = false;
            combinedData.ai.customSystemPrompt = typeof sessionsData.customSystemPrompt === 'string' ? sessionsData.customSystemPrompt : '';
            combinedData.ai.includeTimeContext = sessionsData.includeTimeContext !== false;
            providerIds = sessionsData.providerIds || [];
        } catch (e) { console.error('Failed to load sessions.json', e); }
    }

    if (providerIds.length > 0) {
        const providerPromises = providerIds.map(async (id) => {
            const pPath = await joinPath(channelsDir, `${id}.json`);
            if (await storage.exists(pPath)) {
                try {
                    const pData = JSON.parse(await storage.readFile(pPath));
                    return pData;
                } catch (error) {
                    console.error('[Storage] Failed to parse provider channel file:', pPath, error);
                    return null;
                }
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
                if (p.benchmarkResults) {
                    combinedData.ai!.benchmarkResults![p.provider.id] = p.benchmarkResults;
                }
                if (Array.isArray(p.fetchedModels)) {
                    combinedData.ai!.fetchedModels![p.provider.id] = p.fetchedModels;
                }
            }
        });
    }

    combinedData.ai.providers = await hydrateProvidersWithSecrets(combinedData.ai.providers);

    const normalizedAI = normalizeLoadedAIModels(
      combinedData.ai.providers,
      combinedData.ai.models,
      combinedData.ai.selectedModelId,
      combinedData.ai.sessions
    );
    combinedData.ai.models = normalizedAI.models;
    combinedData.ai.selectedModelId = normalizedAI.selectedModelId;
    combinedData.ai.sessions = normalizedAI.sessions;

    return combinedData;
  } catch (error) {
    console.error('[Storage] Failed to load unified data:', error);
    return createDefaultUnifiedData();
  }
}

async function performSplitSave(data: UnifiedData) {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    
    const configDir = await joinPath(base, '.vlaina');
    const chatDir = await joinPath(configDir, 'chat');
    const channelsDir = await joinPath(chatDir, 'channels');
    
    const mainPath = await joinPath(configDir, MAIN_DATA_FILE);
    const mainBackupPath = await joinPath(configDir, MAIN_DATA_BACKUP_FILE);
    const sessionsPath = await joinPath(chatDir, 'sessions.json');

    if (!(await storage.exists(channelsDir))) {
        await storage.mkdir(channelsDir, true);
    }

    const { ai, ...mainPart } = data;
    
    const mainFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: mainPart as UnifiedData
    };
    await storage.writeFile(mainBackupPath, JSON.stringify(mainFile, null, 2));
    await storage.writeFile(mainPath, JSON.stringify(mainFile, null, 2));

    if (ai) {
        await syncProviderSecrets(ai.providers || []);

        const persistedSessions = ai.sessions.filter((session) => !isTemporarySession(session));
        const persistedSessionIds = new Set(persistedSessions.map((session) => session.id));
        const activeProviderIds = new Set(ai.providers.map((provider) => provider.id));

        const sessionsData = {
            sessions: persistedSessions,
            selectedModelId: ai.selectedModelId,
            currentSessionId: ai.currentSessionId && persistedSessionIds.has(ai.currentSessionId)
              ? ai.currentSessionId
              : null,
            temporaryChatEnabled: false,
            customSystemPrompt: ai.customSystemPrompt || '',
            includeTimeContext: ai.includeTimeContext !== false,
            providerIds: ai.providers.map(p => p.id),
        };
        await storage.writeFile(sessionsPath, JSON.stringify(sessionsData, null, 2));

        for (const provider of ai.providers) {
            const pModels = ai.models.filter(m => m.providerId === provider.id);
            const pData = {
                provider: sanitizeProviderForDisk(provider),
                models: pModels,
                benchmarkResults: ai.benchmarkResults?.[provider.id],
                fetchedModels: ai.fetchedModels?.[provider.id] || []
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
                if (isTauri()) {
                    await aiProviderSecretCommands.deleteProviderSecret(providerId);
                }
                await storage.deleteFile(entry.path);
            } catch (error) {
                console.warn('[Storage] failed to cleanup stale provider channel file:', entry.path, error);
            }
        }

        const ttsChannelsDir = await joinPath(chatDir, 'tts-channels');
        const ttsChannelEntries = await storage.listDir(ttsChannelsDir).catch(() => []);
        for (const entry of ttsChannelEntries) {
            if (!entry.isFile || !entry.name.endsWith('.json')) {
                continue;
            }
            const providerId = entry.name.slice(0, -5);
            try {
                if (isTauri()) {
                    await aiProviderSecretCommands.deleteProviderSecret(providerId);
                }
                await storage.deleteFile(entry.path);
            } catch (error) {
                console.warn('[Storage] failed to cleanup removed TTS provider channel file:', entry.path, error);
            }
        }
    }
}

const unifiedSaveQueue = createPersistenceQueue<UnifiedData>({
  debounceMs: 120,
  write: async (data) => {
    await performSplitSave(data);
    hasShownPersistenceFailureToast = false;
    triggerAutoSyncIfEligible();
  },
  onError: (error) => {
    console.error('[Storage] save failed:', error);
    if (!hasShownPersistenceFailureToast) {
      hasShownPersistenceFailureToast = true;
      useToastStore
        .getState()
        .addToast('Failed to save changes securely. Please try again.', 'error', 5000);
    }
  },
});

export async function saveUnifiedData(data: UnifiedData): Promise<void> {
  unifiedSaveQueue.schedule(data);
}

export async function flushPendingSave(): Promise<void> {
  await unifiedSaveQueue.flush();
}

export function cancelPendingSave(): void {
  unifiedSaveQueue.cancel();
}

export async function saveUnifiedDataImmediate(data: UnifiedData): Promise<void> {
  await unifiedSaveQueue.saveNow(data);
}

function triggerAutoSyncIfEligible(): void {
  autoSyncTrigger?.();
}
