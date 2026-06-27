import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { hasElectronDesktopBridge } from '@/lib/desktop/backend';
import { createPersistenceQueue } from './persistenceEngine';
import type { AIModel, PersistedBenchmarkItem, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types';
import type { ChatSession } from '@/lib/ai/types';
import { isTemporarySession, isTemporarySessionId } from '@/lib/ai/temporaryChat';
import { getStorageBasePath } from './basePath';
import {
  isSafeChatSessionId,
  isSafeProviderId,
  normalizeLoadedAIModels,
  normalizeLoadedAIProviders,
} from './unifiedStorageAI';
import {
  createDefaultUnifiedData,
  type CustomIcon,
  type DataFile,
  type UnifiedData,
} from './unifiedStorageTypes';
import { isSafeImportedMarkdownThemeId } from '@/lib/markdown/theme-compatibility/types';

export type {
  CustomIcon,
  TimezoneInfo,
  UnifiedData,
} from './unifiedStorageTypes';

export interface UnifiedSavePatch {
  customIcons?: true;
  ai?: {
    sessions?: true;
    providers?: true;
  };
  settings?: {
    timezone?: UnifiedData['settings']['timezone'];
    markdown?: Omit<Partial<UnifiedData['settings']['markdown']>, 'body' | 'codeBlock'> & {
      codeBlock?: Partial<UnifiedData['settings']['markdown']['codeBlock']>;
      body?: Partial<NonNullable<UnifiedData['settings']['markdown']['body']>>;
      theme?: Partial<NonNullable<UnifiedData['settings']['markdown']['theme']>>;
    };
    ui?: Partial<NonNullable<UnifiedData['settings']['ui']>>;
  };
}

interface UnifiedSaveRequest {
  data: UnifiedData;
  patch?: UnifiedSavePatch;
  persistAI: boolean;
  persistProviders: boolean;
}

const MAIN_DATA_FILE = 'settings.json';
const MAIN_DATA_BACKUP_FILE = 'settings.backup.json';
const AI_SESSIONS_FILE_VERSION = 1;
const AI_PROVIDER_FILE_VERSION = 1;
export const MAX_MAIN_DATA_BYTES = 2 * 1024 * 1024;
export const MAX_AI_SESSIONS_BYTES = 2 * 1024 * 1024;
export const MAX_AI_PROVIDER_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_AI_SESSION_RECORDS = 5000;
const MAX_AI_ID_LIST_ENTRIES = 5000;
export const MAX_AI_PROVIDERS = 200;
export const MAX_AI_PROVIDER_MODELS = 2000;
export const MAX_AI_PROVIDER_FETCHED_MODELS = 2000;
export const MAX_AI_PROVIDER_BENCHMARK_ITEMS = 2000;
export const MAX_AI_PROVIDER_BENCHMARK_SCAN_ITEMS = 10_000;
const MAX_BOUNDED_ID_LIST_SCAN_RECORDS = 10_000;
const MAX_AI_SESSION_METADATA_SCAN_RECORDS = 10_000;
export const MAX_SETTINGS_TIMEZONE_CITY_CHARS = 512;
export const MAX_SETTINGS_UI_THEME_ID_CHARS = 512;
const SETTINGS_NOTES_CHAT_FLOATING_MIN_WIDTH = 320;
const SETTINGS_NOTES_CHAT_FLOATING_MIN_HEIGHT = 420;
const SETTINGS_NOTES_CHAT_FLOATING_MAX_WIDTH = 760;
const SETTINGS_NOTES_CHAT_FLOATING_MAX_HEIGHT = 920;
const MAX_AI_SESSION_TITLE_CHARS = 4096;
const MAX_AI_SESSION_MODEL_ID_CHARS = 4096;
const MAX_AI_CUSTOM_SYSTEM_PROMPT_CHARS = 64 * 1024;
const MAX_AI_PROVIDER_SAVE_SCAN_RECORDS = 10_000;
const MAX_AI_MODEL_SAVE_SCAN_RECORDS = 20_000;
const MAX_AI_FETCHED_MODEL_SAVE_SCAN_RECORDS = 10_000;
const MAX_AI_MODEL_FIELD_CHARS = 4096;
const MAX_AI_BENCHMARK_ERROR_CHARS = 4096;
export const MAX_AI_PROVIDER_FILE_SCAN_ENTRIES = 10_000;
export const MAX_AI_PROVIDER_STORAGE_CONCURRENCY = 10;
export const MAX_CUSTOM_ICONS = 2000;
export const MAX_CUSTOM_ICON_ID_CHARS = 4096;
export const MAX_CUSTOM_ICON_URL_CHARS = 4096;
export const MAX_CUSTOM_ICON_NAME_CHARS = 512;
export const MAX_DELETED_CUSTOM_ICON_IDS = 5000;
const MAX_CUSTOM_ICON_RECORDS = 5000;
const MAX_DELETED_CUSTOM_ICON_ID_RECORDS = 10_000;

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

interface AIProviderFileData {
  provider: Provider;
  models: AIModel[];
  benchmarkResults?: ProviderBenchmarkRecord;
  fetchedModels: string[];
}

interface AIProviderFile {
  version: typeof AI_PROVIDER_FILE_VERSION;
  providerId: string;
  updatedAt: number;
  data: AIProviderFileData;
}

let autoSyncTrigger: (() => void) | null = null;
let autoSyncTriggerRegistrationId = 0;
let hasShownPersistenceFailureToast = false;
let hasShownSecretLoadFailureToast = false;

async function getAIProviderSecretCommands() {
  const { aiProviderSecretCommands } = await import('@/lib/desktop/secretsCommands');
  return aiProviderSecretCommands;
}

function showStorageToast(
  messageKey: 'storage.keychainUnavailable' | 'storage.saveFailed',
  type: 'error',
  duration: number,
): void {
  void Promise.all([
    import('@/stores/useToastStore'),
    import('@/lib/i18n'),
  ])
    .then(([toastStore, i18n]) => {
      toastStore.useToastStore
        .getState()
        .addToast(i18n.translate(messageKey), type, duration);
    })
    .catch(() => {
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSettingsNotesChatFloatingSize(
  value: unknown,
  fallback: NonNullable<UnifiedData['settings']['ui']>['notesChatFloatingSize'],
): NonNullable<UnifiedData['settings']['ui']>['notesChatFloatingSize'] {
  if (!isRecord(value)) {
    return fallback;
  }

  const { width, height } = value;
  if (typeof width !== 'number' || typeof height !== 'number') {
    return fallback;
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return fallback;
  }

  return {
    width: Math.max(
      SETTINGS_NOTES_CHAT_FLOATING_MIN_WIDTH,
      Math.min(SETTINGS_NOTES_CHAT_FLOATING_MAX_WIDTH, Math.round(width))
    ),
    height: Math.max(
      SETTINGS_NOTES_CHAT_FLOATING_MIN_HEIGHT,
      Math.min(SETTINGS_NOTES_CHAT_FLOATING_MAX_HEIGHT, Math.round(height))
    ),
  };
}

function normalizeBoundedIdList(
  value: unknown,
  isSafeId: (item: unknown) => item is string,
  maxItems: number,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  const scanLimit = Math.min(value.length, Math.max(maxItems, MAX_BOUNDED_ID_LIST_SCAN_RECORDS));
  for (let index = 0; index < scanLimit && ids.length < maxItems; index += 1) {
    const item = value[index];
    if (!isSafeId(item) || seen.has(item)) {
      continue;
    }
    seen.add(item);
    ids.push(item);
  }
  return ids;
}

function normalizeBoundedString(value: unknown, maxChars: number): string {
  return typeof value === 'string' ? value.slice(0, maxChars) : '';
}

function getSerializedByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isSerializedWithinLimit(value: string, maxBytes: number): boolean {
  return getSerializedByteLength(value) <= maxBytes;
}

function trimArrayForSerializedLimit<T>(
  items: T[],
  maxBytes: number,
  serialize: (items: T[]) => string,
): T[] {
  if (items.length === 0) {
    return items;
  }
  if (isSerializedWithinLimit(serialize(items), maxBytes)) {
    return items;
  }

  let low = 0;
  let high = items.length;
  let best: T[] = [];
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = items.slice(0, mid);
    if (isSerializedWithinLimit(serialize(candidate), maxBytes)) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const limit = Math.max(1, Math.min(items.length || 1, Math.floor(concurrency)));
  let nextIndex = 0;

  const workers = Array.from({ length: limit }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

function normalizeChatSessionMetadata(value: unknown): ChatSession | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!isSafeChatSessionId(id) || isTemporarySessionId(id)) {
    return null;
  }

  return {
    id,
    title: normalizeBoundedString(value.title, MAX_AI_SESSION_TITLE_CHARS) || 'New Chat',
    modelId: normalizeBoundedString(value.modelId, MAX_AI_SESSION_MODEL_ID_CHARS),
    isPinned: value.isPinned === true,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now(),
  };
}

function normalizeChatSessionMetadataList(value: unknown): ChatSession[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sessions: ChatSession[] = [];
  const seenIds = new Set<string>();
  const scanLimit = Math.min(value.length, MAX_AI_SESSION_METADATA_SCAN_RECORDS);
  for (let index = 0; index < scanLimit && sessions.length < MAX_AI_SESSION_RECORDS; index += 1) {
    const session = normalizeChatSessionMetadata(value[index]);
    if (!session || seenIds.has(session.id)) {
      continue;
    }
    seenIds.add(session.id);
    sessions.push(session);
  }
  return sessions;
}

function normalizeProvidersForSave(value: unknown): Provider[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const providers: Provider[] = [];
  const seenIds = new Set<string>();
  const scanLimit = Math.min(value.length, MAX_AI_PROVIDER_SAVE_SCAN_RECORDS);
  for (let index = 0; index < scanLimit && providers.length < MAX_AI_PROVIDERS; index += 1) {
    const item = value[index];
    if (!isRecord(item)) {
      continue;
    }

    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!isSafeProviderId(id) || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    const endpointType = item.endpointType === 'openai' || item.endpointType === 'anthropic'
      ? item.endpointType
      : undefined;
    const endpointTypeCheckedAt = typeof item.endpointTypeCheckedAt === 'number' && Number.isFinite(item.endpointTypeCheckedAt)
      ? item.endpointTypeCheckedAt
      : undefined;
    providers.push({
      id,
      name: normalizeBoundedString(item.name, MAX_AI_MODEL_FIELD_CHARS) || 'Custom Provider',
      ...(typeof item.icon === 'string' && item.icon.trim()
        ? { icon: item.icon.trim().slice(0, MAX_AI_MODEL_FIELD_CHARS) }
        : {}),
      type: 'newapi',
      ...(endpointType ? { endpointType } : {}),
      ...(endpointTypeCheckedAt !== undefined ? { endpointTypeCheckedAt } : {}),
      apiHost: normalizeBoundedString(item.apiHost, MAX_AI_MODEL_FIELD_CHARS),
      apiKey: normalizeBoundedString(item.apiKey, MAX_AI_MODEL_FIELD_CHARS),
      enabled: item.enabled !== false,
      createdAt: typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : Date.now(),
    });
  }
  return providers;
}

function normalizeAIModelForSave(value: unknown, providerIds: ReadonlySet<string>): AIModel | null {
  if (!isRecord(value)) {
    return null;
  }

  const providerId = typeof value.providerId === 'string' ? value.providerId.trim() : '';
  const apiModelId = typeof value.apiModelId === 'string'
    ? value.apiModelId.trim().slice(0, MAX_AI_MODEL_FIELD_CHARS)
    : '';
  if (!providerIds.has(providerId) || !apiModelId) {
    return null;
  }

  const id = typeof value.id === 'string' && value.id.trim()
    ? value.id.trim().slice(0, MAX_AI_MODEL_FIELD_CHARS)
    : `${providerId}::${apiModelId}`;

  return {
    ...(value as unknown as AIModel),
    id,
    apiModelId,
    providerId,
    name: normalizeBoundedString(value.name, MAX_AI_MODEL_FIELD_CHARS),
    group: normalizeBoundedString(value.group, MAX_AI_MODEL_FIELD_CHARS),
    enabled: value.enabled !== false,
    pinned: value.pinned === true,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now(),
  };
}

function collectProviderModelsForSave(
  value: unknown,
  providerIds: ReadonlySet<string>,
): Map<string, AIModel[]> {
  const modelsByProvider = new Map<string, AIModel[]>();
  for (const providerId of providerIds) {
    modelsByProvider.set(providerId, []);
  }

  if (!Array.isArray(value) || providerIds.size === 0) {
    return modelsByProvider;
  }

  const seenModelIdsByProvider = new Map<string, Set<string>>();
  const scanLimit = Math.min(value.length, MAX_AI_MODEL_SAVE_SCAN_RECORDS);
  for (let index = 0; index < scanLimit; index += 1) {
    const model = normalizeAIModelForSave(value[index], providerIds);
    if (!model) {
      continue;
    }

    const models = modelsByProvider.get(model.providerId);
    if (!models || models.length >= MAX_AI_PROVIDER_MODELS) {
      continue;
    }

    let seenModelIds = seenModelIdsByProvider.get(model.providerId);
    if (!seenModelIds) {
      seenModelIds = new Set<string>();
      seenModelIdsByProvider.set(model.providerId, seenModelIds);
    }
    if (seenModelIds.has(model.id)) {
      continue;
    }

    seenModelIds.add(model.id);
    models.push(model);
  }
  return modelsByProvider;
}

function normalizeFetchedModelsForSave(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const models: string[] = [];
  const seen = new Set<string>();
  const scanLimit = Math.min(value.length, MAX_AI_FETCHED_MODEL_SAVE_SCAN_RECORDS);
  for (let index = 0; index < scanLimit && models.length < MAX_AI_PROVIDER_FETCHED_MODELS; index += 1) {
    const item = value[index];
    const model = typeof item === 'string' ? item.trim().slice(0, MAX_AI_MODEL_FIELD_CHARS) : '';
    if (!model || seen.has(model)) {
      continue;
    }
    seen.add(model);
    models.push(model);
  }
  return models;
}

function normalizeFetchedModelsForLoad(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const models: string[] = [];
  const scanLimit = Math.min(value.length, MAX_AI_FETCHED_MODEL_SAVE_SCAN_RECORDS);
  for (let index = 0; index < scanLimit && models.length < MAX_AI_PROVIDER_FETCHED_MODELS; index += 1) {
    const model = normalizeBoundedString(value[index], MAX_AI_MODEL_FIELD_CHARS).trim();
    if (!model) {
      continue;
    }
    models.push(model);
  }
  return models;
}

function isSafeBenchmarkItemKey(value: string): boolean {
  return value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
}

function normalizeBenchmarkTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

function normalizeProviderBenchmarkItem(value: unknown): PersistedBenchmarkItem | null {
  if (!isRecord(value) || (value.status !== 'success' && value.status !== 'error')) {
    return null;
  }

  return {
    status: value.status,
    ...(typeof value.latency === 'number' && Number.isFinite(value.latency) && value.latency >= 0
      ? { latency: value.latency }
      : {}),
    ...(typeof value.error === 'string'
      ? { error: value.error.slice(0, MAX_AI_BENCHMARK_ERROR_CHARS) }
      : {}),
    checkedAt: normalizeBenchmarkTimestamp(value.checkedAt),
  };
}

function normalizeProviderBenchmarkRecord(value: unknown): ProviderBenchmarkRecord | undefined {
  if (!isRecord(value) || !isRecord(value.items)) {
    return undefined;
  }

  const items: Record<string, PersistedBenchmarkItem> = {};
  let scannedItems = 0;
  let acceptedItems = 0;
  for (const modelId in value.items) {
    if (
      scannedItems >= MAX_AI_PROVIDER_BENCHMARK_SCAN_ITEMS ||
      acceptedItems >= MAX_AI_PROVIDER_BENCHMARK_ITEMS
    ) {
      break;
    }
    scannedItems += 1;
    if (!Object.prototype.hasOwnProperty.call(value.items, modelId)) {
      continue;
    }
    const itemValue = value.items[modelId];
    const normalizedItem = normalizeProviderBenchmarkItem(itemValue);
    const normalizedModelId = modelId.slice(0, MAX_AI_MODEL_FIELD_CHARS);
    if (!normalizedModelId || !isSafeBenchmarkItemKey(normalizedModelId) || !normalizedItem) {
      continue;
    }
    items[normalizedModelId] = normalizedItem;
    acceptedItems += 1;
  }

  const hasErrors = Object.values(items).some((item) => item.status === 'error');
  const derivedOverall =
    acceptedItems === 0
      ? 'idle'
      : hasErrors
        ? 'error'
        : 'success';
  const overall =
    value.overall === 'idle' || value.overall === 'success' || value.overall === 'error'
      ? value.overall
      : derivedOverall;

  return {
    items,
    overall,
    updatedAt: normalizeBenchmarkTimestamp(value.updatedAt),
  };
}

function parseAISessionsFile(value: unknown): AISessionsFileData | null {
  if (!isRecord(value) || value.version !== AI_SESSIONS_FILE_VERSION || !isRecord(value.data)) {
    return null;
  }

  const data = value.data;
  const currentSessionId = typeof data.currentSessionId === 'string' && isSafeChatSessionId(data.currentSessionId)
    ? data.currentSessionId
    : null;

  return {
    sessions: normalizeChatSessionMetadataList(data.sessions),
    selectedModelId: typeof data.selectedModelId === 'string'
      ? normalizeBoundedString(data.selectedModelId, MAX_AI_SESSION_MODEL_ID_CHARS)
      : null,
    unreadSessionIds: normalizeBoundedIdList(data.unreadSessionIds, isSafeChatSessionId, MAX_AI_ID_LIST_ENTRIES),
    currentSessionId,
    temporaryChatEnabled: false,
    customSystemPrompt: normalizeBoundedString(data.customSystemPrompt, MAX_AI_CUSTOM_SYSTEM_PROMPT_CHARS),
    includeTimeContext: data.includeTimeContext !== false,
    webSearchEnabled: data.webSearchEnabled === true,
    providerIds: normalizeBoundedIdList(data.providerIds, isSafeProviderId, MAX_AI_PROVIDERS),
    deletedSessionIds: normalizeBoundedIdList(data.deletedSessionIds, isSafeChatSessionId, MAX_AI_ID_LIST_ENTRIES),
    deletedProviderIds: normalizeBoundedIdList(data.deletedProviderIds, isSafeProviderId, MAX_AI_ID_LIST_ENTRIES),
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

function serializeBoundedAISessionsFile(data: AISessionsFileData): string {
  let sessions = normalizeChatSessionMetadataList(data.sessions);
  let unreadSessionIds = normalizeBoundedIdList(data.unreadSessionIds, isSafeChatSessionId, MAX_AI_ID_LIST_ENTRIES);
  let deletedSessionIds = normalizeBoundedIdList(data.deletedSessionIds, isSafeChatSessionId, MAX_AI_ID_LIST_ENTRIES);
  let deletedProviderIds = normalizeBoundedIdList(data.deletedProviderIds, isSafeProviderId, MAX_AI_ID_LIST_ENTRIES);

  const serialize = () => serializeAISessionsFile({
    ...data,
    sessions,
    unreadSessionIds,
    deletedSessionIds,
    deletedProviderIds,
    customSystemPrompt: normalizeBoundedString(data.customSystemPrompt, MAX_AI_CUSTOM_SYSTEM_PROMPT_CHARS),
  });

  let payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_AI_SESSIONS_BYTES)) {
    return payload;
  }

  sessions = trimArrayForSerializedLimit(sessions, MAX_AI_SESSIONS_BYTES, (nextSessions) => {
    sessions = nextSessions;
    return serialize();
  });
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_AI_SESSIONS_BYTES)) {
    return payload;
  }

  unreadSessionIds = trimArrayForSerializedLimit(unreadSessionIds, MAX_AI_SESSIONS_BYTES, (nextIds) => {
    unreadSessionIds = nextIds;
    return serialize();
  });
  deletedSessionIds = trimArrayForSerializedLimit(deletedSessionIds, MAX_AI_SESSIONS_BYTES, (nextIds) => {
    deletedSessionIds = nextIds;
    return serialize();
  });
  deletedProviderIds = trimArrayForSerializedLimit(deletedProviderIds, MAX_AI_SESSIONS_BYTES, (nextIds) => {
    deletedProviderIds = nextIds;
    return serialize();
  });
  return serialize();
}

function parseAIProviderFile(
  expectedProviderId: string,
  value: unknown,
): AIProviderFileData | null {
  if (!isSafeProviderId(expectedProviderId)) {
    return null;
  }

  if (
    !isRecord(value) ||
    value.version !== AI_PROVIDER_FILE_VERSION ||
    value.providerId !== expectedProviderId ||
    !isRecord(value.data)
  ) {
    return null;
  }

  const data = value.data;
  if (!isRecord(data.provider) || data.provider.id !== expectedProviderId) {
    return null;
  }
  const benchmarkResults = normalizeProviderBenchmarkRecord(data.benchmarkResults);

  return {
    provider: data.provider as unknown as Provider,
    models: Array.isArray(data.models)
      ? data.models.slice(0, MAX_AI_PROVIDER_MODELS) as AIModel[]
      : [],
    ...(benchmarkResults ? { benchmarkResults } : {}),
    fetchedModels: normalizeFetchedModelsForLoad(data.fetchedModels),
  };
}

function serializeAIProviderFile(
  providerId: string,
  data: AIProviderFileData,
): string {
  const payload: AIProviderFile = {
    version: AI_PROVIDER_FILE_VERSION,
    providerId,
    updatedAt: Date.now(),
    data,
  };
  return JSON.stringify(payload, null, 2);
}

function serializeBoundedAIProviderFile(
  providerId: string,
  data: AIProviderFileData,
): string {
  let models = Array.isArray(data.models)
    ? data.models.slice(0, MAX_AI_PROVIDER_MODELS)
    : [];
  let fetchedModels = normalizeFetchedModelsForSave(data.fetchedModels);
  let benchmarkResults = normalizeProviderBenchmarkRecord(data.benchmarkResults);

  const serialize = () => serializeAIProviderFile(providerId, {
    ...data,
    models,
    benchmarkResults,
    fetchedModels,
  });

  let payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_AI_PROVIDER_FILE_BYTES)) {
    return payload;
  }

  benchmarkResults = undefined;
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_AI_PROVIDER_FILE_BYTES)) {
    return payload;
  }

  fetchedModels = trimArrayForSerializedLimit(fetchedModels, MAX_AI_PROVIDER_FILE_BYTES, (nextFetchedModels) => {
    fetchedModels = nextFetchedModels;
    return serialize();
  });
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_AI_PROVIDER_FILE_BYTES)) {
    return payload;
  }

  models = trimArrayForSerializedLimit(models, MAX_AI_PROVIDER_FILE_BYTES, (nextModels) => {
    models = nextModels;
    return serialize();
  });
  return serialize();
}

async function readBoundedTextFile(
  storage: ReturnType<typeof getStorageAdapter>,
  path: string,
  maxBytes: number,
): Promise<string | null> {
  const fileInfo = await storage.stat(path).catch(() => null);
  if (
    fileInfo?.isFile === false ||
    fileInfo?.isDirectory === true ||
    (typeof fileInfo?.size === 'number' && (
      !Number.isFinite(fileInfo.size) ||
      fileInfo.size < 0 ||
      fileInfo.size > maxBytes
    ))
  ) {
    return null;
  }

  const content = await storage.readFile(path, maxBytes);
  return isSerializedWithinLimit(content, maxBytes) ? content : null;
}

async function readExistingAISessionsFile(
  storage: ReturnType<typeof getStorageAdapter>,
  sessionsPath: string,
): Promise<AISessionsFileData | null> {
  if (!(await storage.exists(sessionsPath))) {
    return null;
  }

  try {
    const content = await readBoundedTextFile(storage, sessionsPath, MAX_AI_SESSIONS_BYTES);
    if (content === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(content);
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
  const path = await joinPath(sessionFilesDir, sessionId, 'messages.json');
  return storage.exists(path).catch(() => false);
}

async function mergeSessionsForSafeSave(
  incomingSessions: ChatSession[],
  existingSessionsData: AISessionsFileData | null,
  sessionFilesDir: string,
): Promise<{ sessions: ChatSession[]; deletedSessionIds: string[] }> {
  const normalizedIncomingSessions = normalizeChatSessionMetadataList(incomingSessions);
  const incomingById = new Map(normalizedIncomingSessions.map((session) => [session.id, session]));
  const existingSessions = (existingSessionsData?.sessions || []).filter((session) => !isTemporarySession(session));
  const deletedSessionIds = new Set(existingSessionsData?.deletedSessionIds || []);

  for (const session of existingSessions) {
    if (!incomingById.has(session.id) && !(await sessionMessageFileExists(sessionFilesDir, session.id))) {
      deletedSessionIds.add(session.id);
    }
  }

  const mergedById = new Map<string, ChatSession>();
  for (const session of normalizedIncomingSessions) {
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
  const markdownTheme = settings?.markdown?.theme;
  const showBodyLineNumbers = settings?.markdown?.body?.showLineNumbers;
  const showLineNumbers = settings?.markdown?.codeBlock?.showLineNumbers;
  const lastAppViewMode = settings?.ui?.lastAppViewMode;
  const lastChatSessionId = settings?.ui?.lastChatSessionId;
  const colorMode = settings?.ui?.colorMode;
  const themeId = settings?.ui?.themeId;
  const notesChatFloatingSize = settings?.ui?.notesChatFloatingSize;

  return {
    settings: {
      timezone: {
        offset: Number.isFinite(timezoneOffset) ? timezoneOffset : defaults.settings.timezone.offset,
        city: typeof timezoneCity === 'string' && timezoneCity.trim().length > 0
          ? timezoneCity.slice(0, MAX_SETTINGS_TIMEZONE_CITY_CHARS)
          : defaults.settings.timezone.city,
      },
      markdown: {
        typewriterMode: typewriterMode === true,
        theme: {
          importedThemeId: typeof markdownTheme?.importedThemeId === 'string'
            && markdownTheme.importedThemeId.trim()
            && isSafeImportedMarkdownThemeId(markdownTheme.importedThemeId.trim())
            ? markdownTheme.importedThemeId.trim()
            : null,
        },
        body: {
          showLineNumbers: showBodyLineNumbers === true,
        },
        codeBlock: {
          showLineNumbers: showLineNumbers !== false,
        },
      },
      ui: {
        lastAppViewMode: lastAppViewMode === 'chat' ? 'chat' : 'notes',
        ...(isSafeChatSessionId(lastChatSessionId) && !isTemporarySessionId(lastChatSessionId)
          ? { lastChatSessionId }
          : {}),
        colorMode: colorMode === 'light' || colorMode === 'dark' ? colorMode : 'system',
        themeId: typeof themeId === 'string' && themeId.trim().length > 0
          ? themeId.slice(0, MAX_SETTINGS_UI_THEME_ID_CHARS)
          : defaults.settings.ui?.themeId ?? 'default',
        notesChatFloatingSize: normalizeSettingsNotesChatFloatingSize(
          notesChatFloatingSize,
          defaults.settings.ui?.notesChatFloatingSize
        ),
      },
    },
    customIcons: normalizeCustomIconList(data.customIcons),
    deletedCustomIconIds: normalizeDeletedCustomIconIds(data.deletedCustomIconIds),
    ai: data.ai,
  };
}

function normalizeBoundedCustomIconString(value: unknown, maxChars: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxChars ? value : null;
}

function normalizeCustomIcon(value: unknown): CustomIcon | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeBoundedCustomIconString(value.id, MAX_CUSTOM_ICON_ID_CHARS);
  const url = normalizeBoundedCustomIconString(value.url, MAX_CUSTOM_ICON_URL_CHARS);
  const name = normalizeBoundedCustomIconString(value.name, MAX_CUSTOM_ICON_NAME_CHARS);
  const { createdAt } = value;
  if (!id || !url || !name || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return null;
  }

  return { id, url, name, createdAt };
}

function normalizeCustomIconList(value: unknown): CustomIcon[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const icons: CustomIcon[] = [];
  const seenIds = new Set<string>();
  const scanLimit = Math.min(value.length, MAX_CUSTOM_ICON_RECORDS);
  for (let index = 0; index < scanLimit && icons.length < MAX_CUSTOM_ICONS; index += 1) {
    const icon = normalizeCustomIcon(value[index]);
    if (!icon || seenIds.has(icon.id)) {
      continue;
    }
    seenIds.add(icon.id);
    icons.push(icon);
  }
  return icons;
}

function normalizeDeletedCustomIconIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids: string[] = [];
  const seenIds = new Set<string>();
  const scanLimit = Math.min(value.length, MAX_DELETED_CUSTOM_ICON_ID_RECORDS);
  for (let index = 0; index < scanLimit && ids.length < MAX_DELETED_CUSTOM_ICON_IDS; index += 1) {
    const id = normalizeBoundedCustomIconString(value[index], MAX_CUSTOM_ICON_ID_CHARS);
    if (!id || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    ids.push(id);
  }
  return ids;
}

async function readExistingMainDataFile(
  storage: ReturnType<typeof getStorageAdapter>,
  path: string,
): Promise<UnifiedData | null> {
  if (!(await storage.exists(path))) {
    return null;
  }

  try {
    const content = await readBoundedTextFile(storage, path, MAX_MAIN_DATA_BYTES);
    if (content === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed) || parsed.version !== 2 || !isRecord(parsed.data)) {
      return null;
    }

    return sanitizeUnifiedData(parsed.data as unknown as UnifiedData);
  } catch {
    return null;
  }
}

function mergeCustomIconsForSafeSave(
  incomingData: UnifiedData,
  existingData: UnifiedData | null,
): Pick<UnifiedData, 'customIcons' | 'deletedCustomIconIds'> {
  const incomingDeletedIds = new Set(normalizeDeletedCustomIconIds(incomingData.deletedCustomIconIds));
  const existingDeletedIds = new Set(normalizeDeletedCustomIconIds(existingData?.deletedCustomIconIds));
  const deletedIds = new Set([...existingDeletedIds, ...incomingDeletedIds]);
  const iconsById = new Map<string, CustomIcon>();

  for (const icon of normalizeCustomIconList(existingData?.customIcons)) {
    if (!deletedIds.has(icon.id)) {
      iconsById.set(icon.id, icon);
    }
  }

  for (const icon of normalizeCustomIconList(incomingData.customIcons)) {
    if (!deletedIds.has(icon.id)) {
      iconsById.set(icon.id, icon);
    }
  }

  return {
    customIcons: Array.from(iconsById.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_CUSTOM_ICONS),
    deletedCustomIconIds: Array.from(deletedIds)
      .filter((id) => !iconsById.has(id))
      .slice(0, MAX_DELETED_CUSTOM_ICON_IDS),
  };
}

function mergeUnifiedSavePatches(
  left: UnifiedSavePatch | undefined,
  right: UnifiedSavePatch | undefined,
): UnifiedSavePatch | undefined {
  if (!left) return right;
  if (!right) return left;

  return {
    customIcons: left.customIcons || right.customIcons || undefined,
    ai: {
      sessions: left.ai?.sessions || right.ai?.sessions || undefined,
      providers: left.ai?.providers || right.ai?.providers || undefined,
    },
    settings: {
      ...left.settings,
      ...right.settings,
      markdown: left.settings?.markdown || right.settings?.markdown
        ? {
            ...left.settings?.markdown,
            ...right.settings?.markdown,
            codeBlock: left.settings?.markdown?.codeBlock || right.settings?.markdown?.codeBlock
              ? {
                  ...left.settings?.markdown?.codeBlock,
                  ...right.settings?.markdown?.codeBlock,
                }
              : undefined,
            body: left.settings?.markdown?.body || right.settings?.markdown?.body
              ? {
                  ...left.settings?.markdown?.body,
                  ...right.settings?.markdown?.body,
                }
              : undefined,
            theme: left.settings?.markdown?.theme || right.settings?.markdown?.theme
              ? {
                  ...left.settings?.markdown?.theme,
                  ...right.settings?.markdown?.theme,
                }
              : undefined,
          }
        : undefined,
      ui: left.settings?.ui || right.settings?.ui
        ? {
            ...left.settings?.ui,
            ...right.settings?.ui,
          }
        : undefined,
    },
  };
}

function serializeBoundedMainDataFile(mainFile: DataFile): string {
  let data = mainFile.data as UnifiedData;
  let customIcons = normalizeCustomIconList(data.customIcons);
  let deletedCustomIconIds = normalizeDeletedCustomIconIds(data.deletedCustomIconIds);

  const serialize = () => JSON.stringify({
    ...mainFile,
    data: {
      ...data,
      customIcons,
      deletedCustomIconIds,
    },
  }, null, 2);

  let payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_MAIN_DATA_BYTES)) {
    return payload;
  }

  customIcons = trimArrayForSerializedLimit(customIcons, MAX_MAIN_DATA_BYTES, (nextIcons) => {
    customIcons = nextIcons;
    return serialize();
  });
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_MAIN_DATA_BYTES)) {
    return payload;
  }

  deletedCustomIconIds = trimArrayForSerializedLimit(deletedCustomIconIds, MAX_MAIN_DATA_BYTES, (nextIds) => {
    deletedCustomIconIds = nextIds;
    return serialize();
  });
  payload = serialize();
  if (isSerializedWithinLimit(payload, MAX_MAIN_DATA_BYTES)) {
    return payload;
  }

  data = {
    ...data,
    customIcons: [],
    deletedCustomIconIds: [],
  };
  customIcons = [];
  deletedCustomIconIds = [];
  return serialize();
}

function mergeSettingsForSafeSave(
  incomingSettings: UnifiedData['settings'],
  existingSettings: UnifiedData['settings'] | undefined,
  patch: UnifiedSavePatch | undefined,
): UnifiedData['settings'] {
  const baseSettings = existingSettings || incomingSettings;
  if (!patch?.settings) {
    return baseSettings;
  }

  return {
    ...baseSettings,
    ...(patch.settings.timezone ? { timezone: patch.settings.timezone } : {}),
    markdown: patch.settings.markdown
      ? {
          ...baseSettings.markdown,
          ...patch.settings.markdown,
          codeBlock: patch.settings.markdown.codeBlock
            ? {
                ...baseSettings.markdown.codeBlock,
                ...patch.settings.markdown.codeBlock,
              }
            : baseSettings.markdown.codeBlock,
          body: patch.settings.markdown.body
            ? {
                ...baseSettings.markdown.body,
                ...patch.settings.markdown.body,
              }
            : baseSettings.markdown.body,
          theme: patch.settings.markdown.theme
            ? {
                ...baseSettings.markdown.theme,
                ...patch.settings.markdown.theme,
              }
            : baseSettings.markdown.theme,
        }
      : baseSettings.markdown,
    ui: patch.settings.ui
      ? {
          ...baseSettings.ui,
          ...patch.settings.ui,
        }
      : baseSettings.ui,
  };
}

export function setUnifiedStorageAutoSyncTrigger(trigger: (() => void) | null): void {
  autoSyncTriggerRegistrationId += 1;
  autoSyncTrigger = trigger;
}

export function registerUnifiedStorageAutoSyncTrigger(trigger: () => void): () => void {
  const registrationId = autoSyncTriggerRegistrationId + 1;
  autoSyncTriggerRegistrationId = registrationId;
  autoSyncTrigger = trigger;

  return () => {
    if (autoSyncTriggerRegistrationId !== registrationId) {
      return;
    }
    autoSyncTriggerRegistrationId += 1;
    autoSyncTrigger = null;
  };
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
    const aiProviderSecretCommands = await getAIProviderSecretCommands();
    secretMap = await aiProviderSecretCommands.getProviderSecrets(providers.map((provider) => provider.id));
    hasShownSecretLoadFailureToast = false;
  } catch (error) {
    if (!hasShownSecretLoadFailureToast) {
      hasShownSecretLoadFailureToast = true;
      showStorageToast('storage.keychainUnavailable', 'error', 6000);
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

  const aiProviderSecretCommands = await getAIProviderSecretCommands();
  await mapWithConcurrencyLimit(
    providers,
    MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
    async (provider) => {
      const apiKey = provider.apiKey?.trim() || '';
      if (apiKey) {
        await aiProviderSecretCommands.setProviderSecret(provider.id, apiKey);
      } else {
        await aiProviderSecretCommands.deleteProviderSecret(provider.id);
      }
    }
  );
}

async function deleteProviderSecretsBestEffort(
  providerIds: Iterable<string>,
  deletedProviderSecrets: Set<string>,
): Promise<void> {
  if (!hasElectronDesktopBridge()) {
    return;
  }

  const safeProviderIds = Array.from(new Set(providerIds))
    .filter((providerId) => isSafeProviderId(providerId) && !deletedProviderSecrets.has(providerId));
  if (safeProviderIds.length === 0) {
    return;
  }

  const aiProviderSecretCommands = await getAIProviderSecretCommands();
  await mapWithConcurrencyLimit(
    safeProviderIds,
    MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
    async (providerId) => {
      try {
        await aiProviderSecretCommands.deleteProviderSecret(providerId);
        deletedProviderSecrets.add(providerId);
      } catch {
      }
    }
  );
}

export async function loadUnifiedData(): Promise<UnifiedData> {
  try {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    const configDir = await joinPath(base, '.vlaina');
    const appDir = await joinPath(configDir, 'app');
    const chatDir = await joinPath(configDir, 'chat');
    const mainPath = await joinPath(appDir, MAIN_DATA_FILE);
    const mainBackupPath = await joinPath(appDir, MAIN_DATA_BACKUP_FILE);
    const sessionFilesDir = await joinPath(chatDir, 'sessions');
    const sessionsPath = await joinPath(sessionFilesDir, 'index.json');
    const providersDir = await joinPath(chatDir, 'providers');

    let combinedData = createDefaultUnifiedData();

    const loadMainDataFromPath = async (path: string): Promise<UnifiedData | null> => {
      if (!(await storage.exists(path))) {
        return null;
      }

      try {
        const content = await readBoundedTextFile(storage, path, MAX_MAIN_DATA_BYTES);
        if (content === null) {
          return null;
        }
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
        deletedSessionIds: [],
        messages: {}
    };

    let providerIds: string[] = [];
    if (await storage.exists(sessionsPath)) {
        try {
            const content = await readBoundedTextFile(storage, sessionsPath, MAX_AI_SESSIONS_BYTES);
            if (content === null) {
              throw new Error('AI sessions file size is unavailable or too large');
            }
            const parsedSessionsData: unknown = JSON.parse(content);
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
              aiData.deletedSessionIds = sessionsData.deletedSessionIds;
              aiData.deletedProviderIds = sessionsData.deletedProviderIds;
              providerIds = sessionsData.providerIds;
            }
        } catch {
            console.warn('[Storage] Ignoring invalid AI sessions file:', sessionsPath);
        }
    }

    if (providerIds.length > 0) {
        const loadedProviders = await mapWithConcurrencyLimit(
          providerIds,
          MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
          async (id) => {
            const pPath = await joinPath(providersDir, `${id}.json`);
            if (await storage.exists(pPath)) {
                try {
                    const content = await readBoundedTextFile(storage, pPath, MAX_AI_PROVIDER_FILE_BYTES);
                    if (content === null) {
                      return null;
                    }
                    const parsedProviderData: unknown = JSON.parse(content);
                    return parseAIProviderFile(id, parsedProviderData);
                } catch (error) {
                    return null;
                }
            }
            return null;
          },
        );

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

async function performSplitSave(request: UnifiedSaveRequest) {
    const storage = getStorageAdapter();
    const base = await getBasePath();
    
    const configDir = await joinPath(base, '.vlaina');
    const appDir = await joinPath(configDir, 'app');
    const chatDir = await joinPath(configDir, 'chat');
    const providersDir = await joinPath(chatDir, 'providers');
    const sessionFilesDir = await joinPath(chatDir, 'sessions');
    
    const mainPath = await joinPath(appDir, MAIN_DATA_FILE);
    const mainBackupPath = await joinPath(appDir, MAIN_DATA_BACKUP_FILE);
    const sessionsPath = await joinPath(sessionFilesDir, 'index.json');

    const requiredDirectories = request.persistAI
        ? request.persistProviders
            ? [appDir, chatDir, providersDir, sessionFilesDir]
            : [appDir, chatDir, sessionFilesDir]
        : [appDir];

    for (const directory of requiredDirectories) {
        if (!(await storage.exists(directory))) {
            await storage.mkdir(directory, true);
        }
    }

    const sanitizedData = sanitizeUnifiedData(request.data);
    const existingMainData = await readExistingMainDataFile(storage, mainPath);
    const mergedCustomIconData = mergeCustomIconsForSafeSave(sanitizedData, existingMainData);
    const dataForMainFile: UnifiedData = {
        ...sanitizedData,
        settings: mergeSettingsForSafeSave(
          sanitizedData.settings,
          existingMainData?.settings,
          request.patch,
        ),
        ...mergedCustomIconData,
    };
    const { ai, ...mainPart } = dataForMainFile;
    
    const mainFile: DataFile = {
        version: 2,
        lastModified: Date.now(),
        data: mainPart as UnifiedData
    };
    const mainPayload = serializeBoundedMainDataFile(mainFile);
    await storage.writeFile(mainPath, mainPayload);
    await storage.writeFile(mainBackupPath, mainPayload);

    if (request.persistAI && ai) {
        const requestedPersistedProviders = normalizeProvidersForSave(ai.providers);
        const incomingDeletedProviderIds = new Set(
          normalizeBoundedIdList(ai.deletedProviderIds, isSafeProviderId, MAX_AI_ID_LIST_ENTRIES)
        );

        const existingSessionsData = await readExistingAISessionsFile(storage, sessionsPath);
        const tombstonedProviderIds = new Set([
          ...(existingSessionsData?.deletedProviderIds || []),
          ...incomingDeletedProviderIds,
        ].filter(isSafeProviderId));
        const persistedProviders = requestedPersistedProviders.filter(
          (provider) => !tombstonedProviderIds.has(provider.id)
        );
        const persistedProviderIds = new Set(persistedProviders.map((provider) => provider.id));
        const deletedProviderSecrets = new Set<string>();
        if (request.persistProviders) {
            await syncProviderSecrets(persistedProviders);
            await deleteProviderSecretsBestEffort(incomingDeletedProviderIds, deletedProviderSecrets);
        }

        const incomingPersistedSessions = ai.sessions.filter((session) => !isTemporarySession(session));
        const mergedSessions = await mergeSessionsForSafeSave(
            incomingPersistedSessions,
            existingSessionsData,
            sessionFilesDir,
        );
        const persistedSessions = mergedSessions.sessions;
        const persistedSessionIds = new Set(persistedSessions.map((session) => session.id));
        const mergedProviderIds = request.persistProviders
          ? Array.from(new Set([
            ...persistedProviders.map((provider) => provider.id),
            ...(existingSessionsData?.providerIds || []),
          ]))
          .filter((providerId) => isSafeProviderId(providerId) && !tombstonedProviderIds.has(providerId))
          .slice(0, MAX_AI_PROVIDERS)
          : (existingSessionsData?.providerIds || [])
            .filter((providerId) => isSafeProviderId(providerId) && !tombstonedProviderIds.has(providerId))
            .slice(0, MAX_AI_PROVIDERS);
        const activeProviderIds = new Set(mergedProviderIds);
        const deletedProviderIds = Array.from(tombstonedProviderIds).filter(
          (providerId) => !activeProviderIds.has(providerId)
        );
        const modelsByProvider = collectProviderModelsForSave(ai.models, persistedProviderIds);
        const activeModelIds = new Set(
          Array.from(modelsByProvider.values()).flat().map((model) => model.id)
        );

        const sessionsData = {
            sessions: persistedSessions,
            selectedModelId: request.persistProviders && ai.selectedModelId && activeModelIds.has(ai.selectedModelId)
              ? ai.selectedModelId
              : request.persistProviders ? null : ai.selectedModelId,
            unreadSessionIds: normalizeBoundedIdList(ai.unreadSessionIds, isSafeChatSessionId, MAX_AI_ID_LIST_ENTRIES)
              .filter((sessionId) => persistedSessionIds.has(sessionId)),
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
        await storage.writeFile(sessionsPath, serializeBoundedAISessionsFile(sessionsData));

        if (!request.persistProviders) {
            return;
        }

        for (const provider of persistedProviders) {
            const pModels = modelsByProvider.get(provider.id) || [];
            const pData = {
                provider: sanitizeProviderForDisk(provider),
                models: pModels,
                benchmarkResults: normalizeProviderBenchmarkRecord(ai.benchmarkResults?.[provider.id]),
                fetchedModels: normalizeFetchedModelsForSave(ai.fetchedModels?.[provider.id])
            };
            const pPath = await joinPath(providersDir, `${provider.id}.json`);
            await storage.writeFile(pPath, serializeBoundedAIProviderFile(provider.id, pData));
        }

        const providerEntries = await storage.listDir(providersDir).catch(() => []);
        for (
            let entryIndex = 0;
            entryIndex < providerEntries.length && entryIndex < MAX_AI_PROVIDER_FILE_SCAN_ENTRIES;
            entryIndex += 1
        ) {
            const entry = providerEntries[entryIndex];
            if (!entry.isFile || !entry.name.endsWith('.json')) {
                continue;
            }
            const providerId = entry.name.slice(0, -5);
            if (activeProviderIds.has(providerId) || !deletedProviderIds.includes(providerId)) {
                continue;
            }
            try {
                await deleteProviderSecretsBestEffort([providerId], deletedProviderSecrets);
                await storage.deleteFile(entry.path);
            } catch (error) {
            }
        }

    }
}

let pendingUnifiedSavePatch: UnifiedSavePatch | undefined;
let pendingUnifiedSaveRequiresFullWrite = false;

const unifiedSaveQueue = createPersistenceQueue<UnifiedSaveRequest>({
  debounceMs: 120,
  write: async (request) => {
    await performSplitSave(request);
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = false;
    hasShownPersistenceFailureToast = false;
    triggerAutoSyncIfEligible();
  },
  onError: (_error) => {
    if (!hasShownPersistenceFailureToast) {
      hasShownPersistenceFailureToast = true;
      showStorageToast('storage.saveFailed', 'error', 5000);
    }
  },
});

function shouldPersistAIForPatch(patch: UnifiedSavePatch | undefined): boolean {
  return !!patch?.ai?.sessions || !!patch?.ai?.providers;
}

function shouldPersistProvidersForPatch(patch: UnifiedSavePatch | undefined): boolean {
  return !!patch?.ai?.providers;
}

export async function saveUnifiedData(data: UnifiedData, patch?: UnifiedSavePatch): Promise<void> {
  if (patch) {
    pendingUnifiedSavePatch = mergeUnifiedSavePatches(pendingUnifiedSavePatch, patch);
  } else {
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = true;
  }

  unifiedSaveQueue.schedule({
    data,
    patch: pendingUnifiedSaveRequiresFullWrite ? undefined : pendingUnifiedSavePatch,
    persistAI: pendingUnifiedSaveRequiresFullWrite || shouldPersistAIForPatch(pendingUnifiedSavePatch),
    persistProviders: pendingUnifiedSaveRequiresFullWrite || shouldPersistProvidersForPatch(pendingUnifiedSavePatch),
  });
}

export async function flushPendingSave(): Promise<void> {
  await unifiedSaveQueue.flush();
}

export function cancelPendingSave(): void {
  pendingUnifiedSavePatch = undefined;
  pendingUnifiedSaveRequiresFullWrite = false;
  unifiedSaveQueue.cancel();
}

export async function saveUnifiedDataImmediate(data: UnifiedData, patch?: UnifiedSavePatch): Promise<void> {
  if (patch) {
    pendingUnifiedSavePatch = mergeUnifiedSavePatches(pendingUnifiedSavePatch, patch);
  } else {
    pendingUnifiedSavePatch = undefined;
    pendingUnifiedSaveRequiresFullWrite = true;
  }

  await unifiedSaveQueue.saveNow({
    data,
    patch: pendingUnifiedSaveRequiresFullWrite ? undefined : pendingUnifiedSavePatch,
    persistAI: pendingUnifiedSaveRequiresFullWrite || shouldPersistAIForPatch(pendingUnifiedSavePatch),
    persistProviders: pendingUnifiedSaveRequiresFullWrite || shouldPersistProvidersForPatch(pendingUnifiedSavePatch),
  });
}

function triggerAutoSyncIfEligible(): void {
  autoSyncTrigger?.();
}
