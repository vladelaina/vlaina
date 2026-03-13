import type { AIModel, ChatSession, Provider } from '@/lib/ai/types';
import { buildScopedModelId } from '@/lib/ai/utils';

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
