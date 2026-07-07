import type { Provider } from '@/lib/ai/types'
import { isManagedProviderId } from '@/lib/ai/managedService'

export function createModelSelectorProviderOrder(providers: Array<Pick<Provider, 'id'>>): Map<string, number> {
  return new Map(providers.map((provider, index) => [provider.id, index] as const))
}

export function compareModelSelectorProviderIds(
  providerOrder: Map<string, number>,
  leftProviderId: string,
  rightProviderId: string
): number {
  const leftManaged = isManagedProviderId(leftProviderId)
  const rightManaged = isManagedProviderId(rightProviderId)
  if (leftManaged !== rightManaged) {
    return leftManaged ? 1 : -1
  }

  const leftOrder = providerOrder.get(leftProviderId) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = providerOrder.get(rightProviderId) ?? Number.MAX_SAFE_INTEGER
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  return leftProviderId.localeCompare(rightProviderId)
}
