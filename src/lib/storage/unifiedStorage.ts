import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { createPersistenceQueue } from './persistenceEngine';
import type { AIModel, ChatMessage, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types';
import type { ChatSession } from '@/lib/ai/types';
import { isTemporarySession } from '@/lib/ai/temporaryChat';
import { getStorageBasePath } from './basePath';
import { loadSessionJson } from './chatStorage';
import {
  isSafeChatSessionId,
  isSafeProviderId,
  normalizeLoadedAIModels,
  normalizeLoadedAIProviders,
} from './unifiedStorageAI';
import { aiProviderSecretCommands } from '@/lib/desktop/secretsCommands';
import { translate } from '@/lib/i18n';
import { useToastStore } from '@/stores/useToastStore';
import {
  createDefaultUnifiedData,
  type DataFile,
  type UnifiedData,
} from './unifiedStorageTypes';

export type {
  CustomIcon,
  TimezoneInfo,
  UnifiedData,
} from './unifiedStorageTypes';

const MAIN_DATA_FILE = 'data.json';
const MAIN_DATA_BACKUP_FILE = 'data.backup.json';
const AI_SESSIONS_FILE_VERSION = 1;
const AI_PROVIDER_CHANNEL_FILE_VERSION = 1;

interface AISessionsFileData {
  sessions: ChatSession[];
  selectedModelId: string | null;
  unreadSessionIds: string[];
  currentSessionId: string | null;
  temporaryChatEnabled: boolean;
  customSystemPrompt: string;
  includeTimeContext: boolean;
  webSearchEnabled: boolean;
  providerIds: string[];
  deletedSessionIds: string[];
  deletedProviderIds: string[];
}

interface AISessionsFile {
  version: typeof AI_SESSIONS_FILE_VERSION;
  updatedAt: number;
  data: AISessionsFileData;
}

interface AIProviderChannelFileData {
  provider: Provider;
  models: AIModel[];
  benchmarkResults?: ProviderBenchmarkRecord;
  fetchedModels: string[];
}

interface AIProviderChannelFile {
  version: typeof AI_PROVIDER_CHANNEL_FILE_VERSION;
  providerId: string;
  updatedAt: number;
  data: AIProviderChannelFileData;
}

let autoSyncTrigger: (() => void) | null = null;
let hasShownPersistenceFailureToast = false;
let hasShownSecretLoadFailureToast = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAISessionsFile(value: unknown): AISessionsFileData | null {
  if (!isRecord(value) || value.version !== AI_SESSIONS_FILE_VERSION || !isRecord(value.data)) {
    return null;
  }

  const data = value.data;
  return {
    sessions: Array.isArray(data.sessions) ? data.sessions as ChatSession[] : [],
    selectedModelId: typeof data.selectedModelId === 'string' ? data.selectedModelId : null,
    unreadSessionIds: Array.isArray(data.unreadSessionIds)
      ? data.unreadSessionIds.filter((sessionId): sessionId is string => typeof sessionId === 'string')
      : [],
    currentSessionId: typeof data.currentSessionId === 'string' ? data.currentSessionId : null,
    temporaryChatEnabled: false,
    customSystemPrompt: typeof data.customSystemPrompt === 'string' ? data.customSystemPrompt : '',
    includeTimeContext: data.includeTimeContext !== false,
    webSearchEnabled: data.webSearchEnabled === true,
    providerIds: Array.isArray(data.providerIds) ? data.providerIds.filter(isSafeProviderId) : [],
    deletedSessionIds: Array.isArray(data.deletedSessionIds)
      ? data.deletedSessionIds.filter(isSafeChatSessionId)
      : [],
    deletedProviderIds: Array.isArray(data.deletedProviderIds)
      ? data.deletedProviderIds.filter(isSafeProviderId)
      : [],
  };
}

function serializeAISessionsFile(data: AISessionsFileData): string {
  const payload: AISessionsFile = {
    version: AI_SESSIONS_FILE_VERSION,
    updatedAt: Date.now(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

function parseAIProviderChannelFile(
  expectedProviderId: string,
  value: unknown,
): AIProviderChannelFileData | null {
  if (!isSafeProviderId(expectedProviderId)) {
    return null;
  }

  if (
    !isRecord(value) ||
    value.version !== AI_PROVIDER_CHANNEL_FILE_VERSION ||
    value.providerId !== expectedProviderId ||
    !isRecord(value.data)
  ) {
    return null;
  }

  const data = value.data;
  if (!isRecord(data.provider) || data.provider.id !== expectedProviderId) {
    return null;
  }

  return {
    provider: data.provider as unknown as Provider,
    models: Array.isArray(data.models) ? data.models as AIModel[] : [],
    ...(isRecord(data.benchmarkResults)
      ? { benchmarkResults: data.benchmarkResults as unknown as ProviderBenchmarkRecord }
      : {}),
    fetchedModels: Array.isArray(data.fetchedModels)
      ? data.fetchedModels.filter((model): model is string => typeof model === 'string')
      : [],
  };
}

function serializeAIProviderChannelFile(
  providerId: string,
  data: AIProviderChannelFileData,
): string {
  const payload: AIProviderChannelFile = {
    version: AI_PROVIDER_CHANNEL_FILE_VERSION,
    providerId,
    updatedAt: Date.now(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

function buildRecoveredSessionTitle(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === 'user');
  const source = firstUserMessage?.content || messages[0]?.content || '';
  const normalized = source
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return 'Recovered Chat';
  }

  return normalized.length > 60 ? `${normalized.slice(0, 60)}...` : normalized;
}

function buildRecoveredSession(sessionId: string, messages: ChatMessage[]): ChatSession {
  const timestamps = messages
    .map((message) => message.timestamp)
    .filter((timestamp) => Number.isFinite(timestamp));
  const now = Date.now();
  const createdAt = timestamps.length > 0 ? Math.min(...timestamps) : now;
  const updatedAt = timestamps.length > 0 ? Math.max(...timestamps) : now;
  const modelId = [...messages]
    .reverse()
    .find((message) => typeof message.modelId === 'string' && message.modelId.trim())?.modelId || '';

  return {
    id: sessionId,
    title: buildRecoveredSessionTitle(messages),
    modelId,
    createdAt,
    updatedAt,
  };
}

async function recoverOrphanChatSessions(
  sessionsDir: string,
  existingSessions: ChatSession[],
): Promise<ChatSession[]> {
  const storage = getStorageAdapter();
  const existingSessionIds = new Set(existingSessions.map((session) => session.id));
  const entries = await storage.listDir(sessionsDir).catch(() => []);
  const recoveredSessions: ChatSession[] = [];

  for (const entry of entries) {
    if (!entry.isFile || !entry.name.endsWith('.json')) {
      continue;
    }

    const sessionId = entry.name.slice(0, -5);
    if (existingSessionIds.has(sessionId)) {
      continue;
    }

    const messages = await loadSessionJson(sessionId).catch(() => null);
    if (!messages) {
      continue;
    }

    recoveredSessions.push(buildRecoveredSession(sessionId, messages));
    existingSessionIds.add(sessionId);
  }

  return recoveredSessions;
}

async function readExistingAISessionsFile(
  storage: ReturnType<typeof getStorageAdapter>,
  sessionsPath: string,
): Promise<AISessionsFileData | null> {
  if (!(await storage.exists(sessionsPath))) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(await storage.readFile(sessionsPath));
    return parseAISessionsFile(parsed);
  } catch {
    return null;
  }
}

async function sessionMessageFileExists(sessionFilesDir: string, sessionId: string): Promise<boolean> {
  if (!isSafeChatSessionId(sessionId)) {
    return false;
  }

  const storage = getStorageAdapter();
  const path = await joinPath(sessionFilesDir, `${sessionId}.json`);
  return storage.exists(path).catch(() => false);
}

async function mergeSessionsForSafeSave(
  incomingSessions: ChatSession[],
  existingSessionsData: AISessionsFileData | null,
  sessionFilesDir: string,
): Promise<{ sessions: ChatSession[]; deletedSessionIds: string[] }> {
  const incomingById = new Map(incomingSessions.map((session) => [session.id, session]));
  const existingSessions = existingSessionsData?.sessions || [];
  const deletedSessionIds = new Set(existingSessionsData?.deletedSessionIds || []);

  for (const session of existingSessions) {
    if (!incomingById.has(session.id) && !(await sessionMessageFileExists(sessionFilesDir, session.id))) {
      deletedSessionIds.add(session.id);
    }
  }

  const mergedById = new Map<string, ChatSession>();
  for (const session of incomingSessions) {
    if (deletedSessionIds.has(session.id)) {
      continue;
    }

    const existedOnDisk = existingSessions.some((existing) => existing.id === session.id);
    if (existedOnDisk && !(await sessionMessageFileExists(sessionFilesDir, session.id))) {
      deletedSessionIds.add(session.id);
      continue;
    }

    mergedById.set(session.id, session);
  }

  for (const session of existingSessions) {
    if (mergedById.has(session.id) || deletedSessionIds.has(session.id)) {
      continue;
    }

    if (await sessionMessageFileExists(sessionFilesDir, session.id)) {
      mergedById.set(session.id, session);
    }
  }

  return {
    sessions: Array.from(mergedById.values()).sort((a, b) => b.updatedAt - a.updatedAt),
    deletedSessionIds: Array.from(deletedSessionIds),
  };
}

function sanitizeUnifiedData(data: UnifiedData): UnifiedData {
  const defaults = createDefaultUnifiedData();
  const settings = data.settings;
  const timezoneOffset = settings?.timezone?.offset;
  const timezoneCity = settings?.timezone?.city;
  const typewriterMode = settings?.markdown?.typewriterMode;
  const showLineNumbers = settings?.markdown?.codeBlock?.showLineNumbers;
  const lastAppViewMode = settings?.ui?.lastAppViewMode;

  return {
    settings: {
      timezone: {
        offset: Number.isFinite(timezoneOffset) ? timezoneOffset : defaults.settings.timezone.offset,
        city: typeof timezoneCity === 'string' && timezoneCity.trim().length > 0
          ? timezoneCity
          : defaults.settings.timezone.city,
      },
      markdown: {
        typewriterMode: typewriterMode === true,
        codeBlock: {
          showLineNumbers: showLineNumbers !== false,
        },
      },
      ui: {
        lastAppViewMode: lastAppViewMode === 'chat' ? 'chat' : 'notes',
      },
    },
    customIcons: Array.isArray(data.customIcons) ? data.customIcons : [],
    deletedCustomIconIds: Array.isArray(data.deletedCustomIconIds)
      ? data.deletedCustomIconIds.filter((id): id is string => typeof id === 'string')
      : [],
    ai: data.ai,
  };
}

export function setUnifiedStorageAutoSyncTrigger(trigger: (() => void) | null): void {
  autoSyncTrigger = trigger;
}

async function getBasePath(): Promise<string> {
  return getStorageBasePath();
}

async function hydrateProvidersWithSecrets(
  providers: Provider[]
): Promise<Provider[]> {
  if (!hasElectronDesktopBridge() || providers.length === 0) {
    return providers;
  }

  let secretMap: Record<string, string> = {};
  try {
    secretMap = await aiProviderSecretCommands.getProviderSecrets(providers.map((provider) => provider.id));
    hasShownSecretLoadFailureToast = false;
  } catch (error) {
    if (!hasShownSecretLoadFailureToast) {
      hasShownSecretLoadFailureToast = true;
      useToastStore
        .getState()
        .addToast(translate('storage.keychainUnavailable'), 'error', 6000);
    }
  }

  return providers.map((provider) => {
      const storedSecret = secretMap[provider.id]?.trim() || '';
      return storedSecret ? { ...provider, apiKey: storedSecret } : { ...provider, apiKey: '' };
    });
}

function sanitizeProviderForDisk(provider: Provider): Provider {
  if (!hasElectronDesktopBridge()) {
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
  if (!hasElectronDesktopBridge()) {
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
    const sessionFilesDir = await joinPath(chatDir, 'sessions');
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
        return null;
      } catch (error) {
        return null;
      }
    };

    const loadedMainData = await loadMainDataFromPath(mainPath);
    if (loadedMainData) {
      combinedData = sanitizeUnifiedData({ ...combinedData, ...loadedMainData });
    } else {
      const loadedBackupData = await loadMainDataFromPath(mainBackupPath);
      if (loadedBackupData) {
        combinedData = sanitizeUnifiedData({ ...combinedData, ...loadedBackupData });
      }
    }

    combinedData.ai = {
        providers: [],
        models: [],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [],
        unreadSessionIds: [],
        selectedModelId: null,
        currentSessionId: null,
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
        webSearchEnabled: false,
        deletedProviderIds: [],
        messages: {}
    };

    let providerIds: string[] = [];
    if (await storage.exists(sessionsPath)) {
        try {
            const parsedSessionsData: unknown = JSON.parse(await storage.readFile(sessionsPath));
            const sessionsData = parseAISessionsFile(parsedSessionsData);
            if (!sessionsData) {
              console.warn('[Storage] Ignoring invalid AI sessions file:', sessionsPath);
            } else {
              const loadedSessions = Array.isArray(sessionsData.sessions) ? sessionsData.sessions : [];
              const aiData = combinedData.ai;
              aiData.sessions = loadedSessions.filter((session: ChatSession) => !isTemporarySession(session));
              aiData.selectedModelId = sessionsData.selectedModelId;
              const currentSessionId = sessionsData.currentSessionId;
              const hasCurrentSession = currentSessionId
                ? aiData.sessions.some((session) => session.id === currentSessionId)
                : false;
              const unreadSessionIds = sessionsData.unreadSessionIds;
              aiData.currentSessionId = hasCurrentSession ? currentSessionId : null;
              aiData.unreadSessionIds = unreadSessionIds.filter((sessionId: string) =>
                aiData.sessions.some((session) => session.id === sessionId)
              );
              aiData.temporaryChatEnabled = false;
              aiData.customSystemPrompt = sessionsData.customSystemPrompt;
              aiData.includeTimeContext = sessionsData.includeTimeContext;
              aiData.webSearchEnabled = sessionsData.webSearchEnabled;
              providerIds = sessionsData.providerIds;
            }
        } catch {
            console.warn('[Storage] Ignoring invalid AI sessions file:', sessionsPath);
        }
    }

    const recoveredSessions = await recoverOrphanChatSessions(
      sessionFilesDir,
      combinedData.ai.sessions,
    );
    if (recoveredSessions.length > 0) {
      combinedData.ai.sessions = [
        ...recoveredSessions,
        ...combinedData.ai.sessions,
      ].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    if (providerIds.length > 0) {
        const providerPromises = providerIds.map(async (id) => {
            const pPath = await joinPath(channelsDir, `${id}.json`);
            if (await storage.exists(pPath)) {
                try {
                    const parsedProviderData: unknown = JSON.parse(await storage.readFile(pPath));
                    return parseAIProviderChannelFile(id, parsedProviderData);
                } catch (error) {
                    return null;
                }
            }
            return null;
        });

        const loadedProviders = await Promise.all(providerPromises);
        loadedProviders.forEach((p, index) => {
            const providerId = providerIds[index];
            if (p) {
                combinedData.ai!.providers.push(p.provider);
                if (Array.isArray(p.models)) {
                    combinedData.ai!.models.push(...p.models);
                }
                if (p.benchmarkResults) {
                    combinedData.ai!.benchmarkResults![providerId] = p.benchmarkResults;
                }
                if (p.fetchedModels.length > 0) {
                    combinedData.ai!.fetchedModels![providerId] = p.fetchedModels;
                }
            }
        });
    }

    combinedData.ai.providers = normalizeLoadedAIProviders(combinedData.ai.providers);
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

    return sanitizeUnifiedData(combinedData);
  } catch (error) {
    return createDefaultUnifiedData();
  }
}

async function performSplitSave(data: UnifiedData) {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    
    const configDir = await joinPath(base, '.vlaina');
    const chatDir = await joinPath(configDir, 'chat');
    const channelsDir = await joinPath(chatDir, 'channels');
    const sessionFilesDir = await joinPath(chatDir, 'sessions');
    
    const mainPath = await joinPath(configDir, MAIN_DATA_FILE);
    const mainBackupPath = await joinPath(configDir, MAIN_DATA_BACKUP_FILE);
    const sessionsPath = await joinPath(chatDir, 'sessions.json');

    if (!(await storage.exists(channelsDir))) {
        await storage.mkdir(channelsDir, true);
    }

    const sanitizedData = sanitizeUnifiedData(data);
    const { ai, ...mainPart } = sanitizedData;
    
    const mainFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: mainPart as UnifiedData
    };
    const mainPayload = JSON.stringify(mainFile, null, 2);
    await storage.writeFile(mainPath, mainPayload);
    await storage.writeFile(mainBackupPath, mainPayload);

    if (ai) {
        const persistedProviders = (ai.providers || []).filter((provider) => isSafeProviderId(provider.id));
        const incomingDeletedProviderIds = new Set(
          (ai.deletedProviderIds || []).filter(isSafeProviderId)
        );

        await syncProviderSecrets(persistedProviders);

        const existingSessionsData = await readExistingAISessionsFile(storage, sessionsPath);
        const incomingPersistedSessions = ai.sessions.filter((session) => !isTemporarySession(session));
        const mergedSessions = await mergeSessionsForSafeSave(
            incomingPersistedSessions,
            existingSessionsData,
            sessionFilesDir,
        );
        const persistedSessions = mergedSessions.sessions;
        const persistedSessionIds = new Set(persistedSessions.map((session) => session.id));
        const mergedProviderIds = Array.from(new Set([
          ...persistedProviders.map((provider) => provider.id),
          ...(existingSessionsData?.providerIds || []),
        ])).filter((providerId) => isSafeProviderId(providerId) && !incomingDeletedProviderIds.has(providerId));
        const activeProviderIds = new Set(mergedProviderIds);
        const deletedProviderIds = Array.from(new Set([
          ...(existingSessionsData?.deletedProviderIds || []),
          ...incomingDeletedProviderIds,
        ])).filter((providerId) => !activeProviderIds.has(providerId));

        const sessionsData = {
            sessions: persistedSessions,
            selectedModelId: ai.selectedModelId,
            unreadSessionIds: (ai.unreadSessionIds || []).filter((sessionId) => persistedSessionIds.has(sessionId)),
            currentSessionId: ai.currentSessionId && persistedSessionIds.has(ai.currentSessionId)
              ? ai.currentSessionId
              : null,
            temporaryChatEnabled: false,
            customSystemPrompt: ai.customSystemPrompt || '',
            includeTimeContext: ai.includeTimeContext !== false,
            webSearchEnabled: ai.webSearchEnabled === true,
            providerIds: mergedProviderIds,
            deletedSessionIds: mergedSessions.deletedSessionIds,
            deletedProviderIds,
        };
        await storage.writeFile(sessionsPath, serializeAISessionsFile(sessionsData));

        for (const provider of persistedProviders) {
            const pModels = ai.models.filter(m => m.providerId === provider.id);
            const pData = {
                provider: sanitizeProviderForDisk(provider),
                models: pModels,
                benchmarkResults: ai.benchmarkResults?.[provider.id],
                fetchedModels: ai.fetchedModels?.[provider.id] || []
            };
            const pPath = await joinPath(channelsDir, `${provider.id}.json`);
            await storage.writeFile(pPath, serializeAIProviderChannelFile(provider.id, pData));
        }

        const channelEntries = await storage.listDir(channelsDir).catch(() => []);
        for (const entry of channelEntries) {
            if (!entry.isFile || !entry.name.endsWith('.json')) {
                continue;
            }
            const providerId = entry.name.slice(0, -5);
            if (activeProviderIds.has(providerId) || !deletedProviderIds.includes(providerId)) {
                continue;
            }
            try {
                if (hasElectronDesktopBridge() && isSafeProviderId(providerId)) {
                    await aiProviderSecretCommands.deleteProviderSecret(providerId);
                }
                await storage.deleteFile(entry.path);
            } catch (error) {
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
                if (hasElectronDesktopBridge() && isSafeProviderId(providerId)) {
                    await aiProviderSecretCommands.deleteProviderSecret(providerId);
                }
                await storage.deleteFile(entry.path);
            } catch (error) {
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
  onError: (_error) => {
    if (!hasShownPersistenceFailureToast) {
      hasShownPersistenceFailureToast = true;
      useToastStore
        .getState()
        .addToast(translate('storage.saveFailed'), 'error', 5000);
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
