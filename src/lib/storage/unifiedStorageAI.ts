import type { AIModel, ChatSession, Provider } from '@/lib/ai/types';
import { buildScopedModelId, generateModelGroup, generateModelName } from '@/lib/ai/utils';

const MAX_LOADED_AI_MODELS = 10_000;
const MAX_LOADED_AI_MODEL_RECORDS = 20_000;
const MAX_LOADED_AI_SESSIONS = 5_000;
const MAX_LOADED_AI_SESSION_RECORDS = 10_000;
export const MAX_LOADED_AI_PROVIDERS = 200;
const MAX_LOADED_AI_PROVIDER_RECORDS = 500;
export const MAX_LOADED_AI_FIELD_CHARS = 4096;
export const MAX_LOADED_AI_NAME_CHARS = 512;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeEndpointType(value: unknown): Provider['endpointType'] | undefined {
  return value === 'openai' || value === 'anthropic' ? value : undefined;
}

function normalizeLoadedString(value: unknown, maxChars: number, trim = true): string {
  if (typeof value !== 'string') {
    return '';
  }

  const normalized = trim ? value.trim() : value;
  return normalized.slice(0, maxChars);
}

export function isSafeProviderId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
  );
}

export function isSafeChatSessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
  );
}

export function normalizeLoadedAIProviders(providers: unknown[]): Provider[] {
  const now = Date.now();
  const seenIds = new Set<string>();
  const normalized: Provider[] = [];
  let scannedProviders = 0;

  for (const item of providers) {
    if (
      scannedProviders >= MAX_LOADED_AI_PROVIDER_RECORDS ||
      normalized.length >= MAX_LOADED_AI_PROVIDERS
    ) {
      break;
    }
    scannedProviders += 1;
    if (!isRecord(item)) continue;

    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!isSafeProviderId(id) || seenIds.has(id)) continue;
    seenIds.add(id);

    const name = normalizeLoadedString(item.name, MAX_LOADED_AI_NAME_CHARS);
    const apiHost = normalizeLoadedString(item.apiHost, MAX_LOADED_AI_FIELD_CHARS);
    const apiKey = normalizeLoadedString(item.apiKey, MAX_LOADED_AI_FIELD_CHARS, false);
    const icon = normalizeLoadedString(item.icon, MAX_LOADED_AI_FIELD_CHARS);
    const displayName = name
      ? name
      : 'Custom Provider';
    const endpointType = normalizeEndpointType(item.endpointType);
    const endpointTypeCheckedAt = normalizeTimestamp(item.endpointTypeCheckedAt, NaN);

    normalized.push({
      id,
      name: displayName,
      ...(icon ? { icon } : {}),
      type: 'newapi',
      ...(endpointType ? { endpointType } : {}),
      ...(Number.isFinite(endpointTypeCheckedAt) ? { endpointTypeCheckedAt } : {}),
      apiHost,
      apiKey,
      enabled: item.enabled !== false,
      createdAt: normalizeTimestamp(item.createdAt, now),
      updatedAt: normalizeTimestamp(item.updatedAt, now),
    });
  }

  return normalized;
}

export function normalizeLoadedAIModels(
  providers: Provider[],
  models: unknown[],
  selectedModelId: string | null,
  sessions: unknown[]
): {
  models: AIModel[];
  selectedModelId: string | null;
  sessions: ChatSession[];
} {
  const providerIds = new Set(providers.map((provider) => provider.id));
  const now = Date.now();
  const seenModelIds = new Set<string>();
  const normalizedModels: AIModel[] = [];
  let scannedModels = 0;

  for (const item of models) {
    if (
      scannedModels >= MAX_LOADED_AI_MODEL_RECORDS ||
      normalizedModels.length >= MAX_LOADED_AI_MODELS
    ) {
      break;
    }
    scannedModels += 1;
    if (!isRecord(item)) continue;
    const providerId = normalizeLoadedString(item.providerId, MAX_LOADED_AI_FIELD_CHARS);
    const apiModelId = normalizeLoadedString(item.apiModelId, MAX_LOADED_AI_FIELD_CHARS);
    if (!providerIds.has(providerId) || !apiModelId) continue;

    const id = buildScopedModelId(providerId, apiModelId);
    const normalizedId = id.toLowerCase();
    if (seenModelIds.has(normalizedId)) continue;
    seenModelIds.add(normalizedId);

    const name = normalizeLoadedString(item.name, MAX_LOADED_AI_NAME_CHARS);
    const group = normalizeLoadedString(item.group, MAX_LOADED_AI_NAME_CHARS);
    normalizedModels.push({
      id,
      apiModelId,
      name: name || generateModelName(apiModelId),
      providerId,
      group: group || generateModelGroup(apiModelId),
      ...normalizeLoadedModelPrice(item),
      enabled: item.enabled !== false,
      pinned: item.pinned === true,
      createdAt: normalizeTimestamp(item.createdAt, now),
    });
  }

  const availableIds = new Set(normalizedModels.map((model) => model.id));

  const remapModelId = (modelId: string | null | undefined): string | null => {
    if (!modelId) return null;
    if (availableIds.has(modelId)) return modelId;
    return null;
  };

  const seenSessionIds = new Set<string>();
  const normalizedSessions: ChatSession[] = [];
  let scannedSessions = 0;
  for (const item of sessions) {
    if (
      scannedSessions >= MAX_LOADED_AI_SESSION_RECORDS ||
      normalizedSessions.length >= MAX_LOADED_AI_SESSIONS
    ) {
      break;
    }
    scannedSessions += 1;
    if (!isRecord(item)) continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!isSafeChatSessionId(id) || seenSessionIds.has(id)) continue;
    seenSessionIds.add(id);

    const modelId = normalizeLoadedString(item.modelId, MAX_LOADED_AI_FIELD_CHARS);
    const title = normalizeLoadedString(item.title, MAX_LOADED_AI_FIELD_CHARS);
    normalizedSessions.push({
      id,
      title: title || 'New Chat',
      modelId: remapModelId(modelId) || modelId,
      isPinned: item.isPinned === true,
      createdAt: normalizeTimestamp(item.createdAt, now),
      updatedAt: normalizeTimestamp(item.updatedAt, now),
    });
  }

  return {
    models: normalizedModels,
    selectedModelId: remapModelId(selectedModelId),
    sessions: normalizedSessions,
  };
}

function normalizeLoadedModelPrice(item: Record<string, unknown>): Pick<AIModel, 'priceTier' | 'priceScore'> {
  const priceTier = typeof item.priceTier === 'string' ? item.priceTier.trim() : '';
  const normalized: Pick<AIModel, 'priceTier' | 'priceScore'> = {};
  if (
    priceTier === '$' ||
    priceTier === '$$' ||
    priceTier === '$$$' ||
    priceTier === '$$$$' ||
    priceTier === '$$$$$'
  ) {
    normalized.priceTier = priceTier;
  }

  if (typeof item.priceScore === 'number' && Number.isFinite(item.priceScore) && item.priceScore >= 0) {
    normalized.priceScore = item.priceScore;
  }

  return normalized;
}
