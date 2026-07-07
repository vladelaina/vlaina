import type { AIModel, Provider, ProviderBenchmarkRecord } from '@/lib/ai/types';
import { isSafeProviderId } from './unifiedStorageAI';
import {
  AI_PROVIDER_FILE_VERSION,
  MAX_AI_PROVIDER_FILE_BYTES,
  MAX_AI_PROVIDER_MODELS,
  type AIProviderFile,
  type AIProviderFileData,
} from './unifiedStorageSaveTypes';
import {
  isRecord,
  isSerializedWithinLimit,
  trimArrayForSerializedLimit,
} from './unifiedStorageCommon';
import {
  normalizeFetchedModelsForLoad,
  normalizeFetchedModelsForSave,
  normalizeProviderBenchmarkRecord,
} from './unifiedStorageProviderNormalize';

export function parseAIProviderFile(
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

export function serializeAIProviderFile(
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

export function serializeBoundedAIProviderFile(
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
