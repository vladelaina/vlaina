import type { AIModel, PersistedBenchmarkItem, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types';
import { isSafeProviderId } from './unifiedStorageAI';
import {
  MAX_AI_BENCHMARK_ERROR_CHARS,
  MAX_AI_FETCHED_MODEL_SAVE_SCAN_RECORDS,
  MAX_AI_MODEL_FIELD_CHARS,
  MAX_AI_MODEL_SAVE_SCAN_RECORDS,
  MAX_AI_PROVIDER_BENCHMARK_ITEMS,
  MAX_AI_PROVIDER_BENCHMARK_SCAN_ITEMS,
  MAX_AI_PROVIDER_FETCHED_MODELS,
  MAX_AI_PROVIDER_MODELS,
  MAX_AI_PROVIDER_SAVE_SCAN_RECORDS,
  MAX_AI_PROVIDERS,
} from './unifiedStorageSaveTypes';
import { isRecord, normalizeBoundedString } from './unifiedStorageCommon';

export function normalizeProvidersForSave(value: unknown): Provider[] {
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

export function normalizeAIModelForSave(value: unknown, providerIds: ReadonlySet<string>): AIModel | null {
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
  const endpointType = value.endpointType === 'openai' || value.endpointType === 'anthropic'
    ? value.endpointType
    : undefined;
  const endpointTypeCheckedAt = typeof value.endpointTypeCheckedAt === 'number' && Number.isFinite(value.endpointTypeCheckedAt)
    ? value.endpointTypeCheckedAt
    : undefined;

  return {
    ...(value as unknown as AIModel),
    id,
    apiModelId,
    providerId,
    name: normalizeBoundedString(value.name, MAX_AI_MODEL_FIELD_CHARS),
    group: normalizeBoundedString(value.group, MAX_AI_MODEL_FIELD_CHARS),
    endpointType,
    endpointTypeCheckedAt,
    enabled: value.enabled !== false,
    pinned: value.pinned === true,
    createdAt: typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now(),
  };
}

export function collectProviderModelsForSave(
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

export function normalizeFetchedModelsForSave(value: unknown): string[] {
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

export function normalizeFetchedModelsForLoad(value: unknown): string[] {
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

export function isSafeBenchmarkItemKey(value: string): boolean {
  return value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
}

export function normalizeBenchmarkTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Date.now();
}

export function normalizeProviderBenchmarkItem(value: unknown): PersistedBenchmarkItem | null {
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

export function normalizeProviderBenchmarkRecord(value: unknown): ProviderBenchmarkRecord | undefined {
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
