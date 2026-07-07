import type { AIModel, Provider } from '@/lib/ai/types'
import { useAIUIStore } from './chatState'
import { chooseFallbackSelectedModelId } from './providerStoreUtils'

function getCurrentSessionAvailableModelId(
  sessions: Array<{ id: string; modelId: string }>,
  models: AIModel[],
  providers: Provider[]
): string | null {
  const currentSessionId = useAIUIStore.getState().currentSessionId
  if (!currentSessionId) return null

  const sessionModelId = sessions.find((session) => session.id === currentSessionId)?.modelId
  if (!sessionModelId) return null

  const model = models.find((item) => item.id === sessionModelId)
  if (!model || model.enabled === false) return null

  const provider = providers.find((item) => item.id === model.providerId)
  return provider?.enabled === false ? null : model.id
}

export function chooseSessionAwareFallbackSelectedModelId(
  currentSelectedModelId: string | null,
  models: AIModel[],
  providers: Provider[],
  sessions: Array<{ id: string; modelId: string }>,
  preferredProviderId?: string | null
): string | null {
  return getCurrentSessionAvailableModelId(sessions, models, providers) ??
    chooseFallbackSelectedModelId(currentSelectedModelId, models, preferredProviderId)
}
