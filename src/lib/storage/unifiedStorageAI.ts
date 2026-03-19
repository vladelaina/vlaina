import type { AIModel, ChatSession, Provider } from '@/lib/ai/types';
import { buildScopedModelId } from '@/lib/ai/utils';

function splitScopedModelId(modelId: string): { providerId: string; apiModelId: string } | null {
  const separatorIndex = modelId.indexOf('::');
  if (separatorIndex <= 0) return null;

  const providerId = modelId.slice(0, separatorIndex).trim();
  const apiModelId = modelId.slice(separatorIndex + 2).trim();
  if (!providerId || !apiModelId) return null;

  return { providerId, apiModelId };
}

function extractLegacyUpstreamModelId(modelId: string): string | null {
  const scoped = splitScopedModelId(modelId);
  const candidate = scoped?.apiModelId || modelId;
  const separatorIndex = candidate.lastIndexOf('::');
  const upstreamModelId = separatorIndex >= 0 ? candidate.slice(separatorIndex + 2).trim() : candidate.trim();
  return upstreamModelId || null;
}

export function normalizeLoadedAIModels(
  providers: Provider[],
  models: AIModel[],
  selectedModelId: string | null,
  sessions: ChatSession[]
): {
  models: AIModel[];
  selectedModelId: string | null;
  sessions: ChatSession[];
} {
  const providerIds = new Set(providers.map((provider) => provider.id));
  const idMapping = new Map<string, string>();
  const apiModelIdMapping = new Map<string, string[]>();

  const normalizedModels = models
    .filter((model) => providerIds.has(model.providerId))
    .map((model) => {
      const apiModelId =
        typeof (model as AIModel & { apiModelId?: string }).apiModelId === 'string' &&
        (model as AIModel & { apiModelId?: string }).apiModelId.trim().length > 0
          ? (model as AIModel & { apiModelId?: string }).apiModelId.trim()
          : model.id;

      const normalizedId = buildScopedModelId(model.providerId, apiModelId);
      idMapping.set(model.id, normalizedId);
      const apiIds = apiModelIdMapping.get(apiModelId) || [];
      apiIds.push(normalizedId);
      apiModelIdMapping.set(apiModelId, apiIds);
      return {
        ...model,
        id: normalizedId,
        apiModelId,
      };
    });

  const availableIds = new Set(normalizedModels.map((model) => model.id));

  const remapModelId = (modelId: string | null | undefined): string | null => {
    if (!modelId) return null;
    const direct = idMapping.get(modelId) || modelId;
    if (availableIds.has(direct)) return direct;

    const legacyUpstreamModelId = extractLegacyUpstreamModelId(modelId);
    if (legacyUpstreamModelId) {
      const legacyCandidates = apiModelIdMapping.get(legacyUpstreamModelId) || [];
      if (legacyCandidates.length === 1 && availableIds.has(legacyCandidates[0]!)) {
        return legacyCandidates[0]!;
      }
    }

    const fallback = normalizedModels.find((model) => model.apiModelId === modelId)?.id || null;
    return fallback && availableIds.has(fallback) ? fallback : null;
  };

  const normalizedSessions = sessions.map((session) => ({
    ...session,
    modelId: remapModelId(session.modelId) || session.modelId,
  }));

  return {
    models: normalizedModels,
    selectedModelId: remapModelId(selectedModelId),
    sessions: normalizedSessions,
  };
}
