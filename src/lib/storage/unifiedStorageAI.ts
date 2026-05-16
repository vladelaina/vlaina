import type { AIModel, ChatSession, Provider } from '@/lib/ai/types';
import { buildScopedModelId, generateModelGroup, generateModelName } from '@/lib/ai/utils';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeEndpointType(value: unknown): Provider['endpointType'] | undefined {
  return value === 'openai' || value === 'anthropic' ? value : undefined;
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

  for (const item of providers) {
    if (!isRecord(item)) continue;

    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!isSafeProviderId(id) || seenIds.has(id)) continue;
    seenIds.add(id);

    const name = typeof item.name === 'string' && item.name.trim()
      ? item.name.trim()
      : 'Custom Provider';
    const apiHost = typeof item.apiHost === 'string' ? item.apiHost.trim() : '';
    const apiKey = typeof item.apiKey === 'string' ? item.apiKey : '';
    const endpointType = normalizeEndpointType(item.endpointType);
    const endpointTypeCheckedAt = normalizeTimestamp(item.endpointTypeCheckedAt, NaN);

    normalized.push({
      id,
      name,
      icon: typeof item.icon === 'string' ? item.icon : undefined,
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

  const normalizedModels = models
    .flatMap((item) => {
      if (!isRecord(item)) return [];
      const providerId = typeof item.providerId === 'string' ? item.providerId.trim() : '';
      const apiModelId = typeof item.apiModelId === 'string' ? item.apiModelId.trim() : '';
      if (!providerIds.has(providerId) || !apiModelId) return [];

      const id = buildScopedModelId(providerId, apiModelId);
      const normalizedId = id.toLowerCase();
      if (seenModelIds.has(normalizedId)) return [];
      seenModelIds.add(normalizedId);

      return [{
        id,
        apiModelId,
        name: typeof item.name === 'string' && item.name.trim()
          ? item.name.trim()
          : generateModelName(apiModelId),
        providerId,
        group: typeof item.group === 'string' && item.group.trim()
          ? item.group.trim()
          : generateModelGroup(apiModelId),
        ...normalizeLoadedModelPrice(item),
        enabled: item.enabled !== false,
        pinned: item.pinned === true,
        createdAt: normalizeTimestamp(item.createdAt, now),
      }];
    });

  const availableIds = new Set(normalizedModels.map((model) => model.id));

  const remapModelId = (modelId: string | null | undefined): string | null => {
    if (!modelId) return null;
    if (availableIds.has(modelId)) return modelId;
    return null;
  };

  const seenSessionIds = new Set<string>();
  const normalizedSessions = sessions.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!isSafeChatSessionId(id) || seenSessionIds.has(id)) return [];
    seenSessionIds.add(id);

    const modelId = typeof item.modelId === 'string' ? item.modelId : '';
    return [{
      id,
      title: typeof item.title === 'string' && item.title.trim() ? item.title : 'New Chat',
      modelId: remapModelId(modelId) || modelId,
      isPinned: item.isPinned === true,
      createdAt: normalizeTimestamp(item.createdAt, now),
      updatedAt: normalizeTimestamp(item.updatedAt, now),
    }];
  });

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
