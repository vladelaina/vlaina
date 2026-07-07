import { useMemo } from 'react'
import type { MessageKey, MessageValues } from '@/lib/i18n'
import type { AIModel, Provider } from '@/lib/ai/types'
import { isManagedProviderId, MANAGED_PROVIDER_NAME } from '@/lib/ai/managedService'
import {
  MODEL_FAMILIES,
  getModelCategoryId,
  type ModelCategory,
  type ModelCategoryId,
} from '../modelFamilyRegistry'
import { getModelSelectorSearchTerm, modelMatchesSelectorSearch } from '../modelSelectorSearch'
import { sortModelsForDisplay } from '../modelSort'
import {
  compareModelSelectorProviderIds,
  createModelSelectorProviderOrder,
} from '../modelSelectorProviders'
import type { ModelSelectorListRow } from '../modelSelectorTypes'

type Translate = (key: MessageKey, values?: MessageValues) => string

interface UseModelSelectorOptionsParams {
  models: AIModel[]
  providers: Provider[]
  selectedModelId: string | null
  searchQuery: string
  activeCategoryId: ModelCategoryId | null
  t: Translate
}

export function useModelSelectorOptions({
  models,
  providers,
  selectedModelId,
  searchQuery,
  activeCategoryId,
  t,
}: UseModelSelectorOptionsParams) {
  const selectedModel = useMemo(() => {
    if (!selectedModelId) {
      return undefined
    }

    const model = models.find((item) => item.id === selectedModelId)
    if (!model) {
      return undefined
    }

    const provider = providers.find((item) => item.id === model.providerId)
    return model.enabled === false || provider?.enabled === false ? undefined : model
  }, [models, providers, selectedModelId])

  const enabledProviderIds = useMemo(
    () => new Set(providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)),
    [providers]
  )

  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled && enabledProviderIds.has(model.providerId)),
    [enabledProviderIds, models]
  )

  const filteredModels = useMemo(() => {
    const term = getModelSelectorSearchTerm(searchQuery)
    return enabledModels.filter((model) => modelMatchesSelectorSearch(model, term))
  }, [enabledModels, searchQuery])

  const sortedFilteredModels = useMemo(
    () => sortModelsForDisplay(filteredModels),
    [filteredModels],
  )

  const modelCategories = useMemo(() => {
    const categoryCounts = new Map<ModelCategoryId, number>()

    filteredModels.forEach((model) => {
      const categoryId = getModelCategoryId(model)
      categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1)
    })

    const categories: ModelCategory[] = []
    const pinnedCount = filteredModels.filter((model) => model.pinned).length
    categories.push({
      id: 'favorites',
      name: t('chat.favorites'),
      icon: null,
      kind: 'favorites',
      count: pinnedCount,
    })

    MODEL_FAMILIES.forEach((family) => {
      const count = categoryCounts.get(family.id) ?? 0
      if (count === 0) {
        return
      }
      categories.push({
        id: family.id,
        name: family.name,
        icon: family.icon,
        monochromeIcon: family.monochromeIcon,
        kind: 'family',
        count,
      })
    })

    const customCount = categoryCounts.get('custom') ?? 0
    if (customCount > 0) {
      categories.push({
        id: 'custom',
        name: t('chat.customModels'),
        icon: null,
        kind: 'custom',
        count: customCount,
      })
    }

    return categories
  }, [filteredModels, t])

  const visibleActiveCategoryId = useMemo(() => {
    if (activeCategoryId && modelCategories.some((category) => category.id === activeCategoryId)) {
      return activeCategoryId
    }

    const selectedCategoryId = selectedModel ? getModelCategoryId(selectedModel) : null
    if (selectedCategoryId && modelCategories.some((category) => category.id === selectedCategoryId)) {
      return selectedCategoryId
    }

    return modelCategories.find((category) => category.id !== 'favorites')?.id ?? modelCategories[0]?.id ?? null
  }, [activeCategoryId, modelCategories, selectedModel])

  const categoryFilteredModels = useMemo(() => {
    if (!visibleActiveCategoryId) {
      return []
    }

    if (visibleActiveCategoryId === 'favorites') {
      return sortedFilteredModels.filter((model) => model.pinned)
    }

    return sortedFilteredModels.filter((model) => getModelCategoryId(model) === visibleActiveCategoryId)
  }, [sortedFilteredModels, visibleActiveCategoryId])

  const groupedFilteredModels = useMemo(() => {
    const providerMap = new Map(providers.map((provider) => [provider.id, provider]))
    const providerOrder = createModelSelectorProviderOrder(providers)
    const modelsByProvider = new Map<string, AIModel[]>()

    categoryFilteredModels.forEach((model) => {
      const existing = modelsByProvider.get(model.providerId)
      if (existing) {
        existing.push(model)
        return
      }
      modelsByProvider.set(model.providerId, [model])
    })

    return Array.from(modelsByProvider.entries())
      .sort(([leftProviderId], [rightProviderId]) =>
        compareModelSelectorProviderIds(providerOrder, leftProviderId, rightProviderId)
      )
      .map(([providerId, providerModels]) => ({
        providerId,
        providerName: isManagedProviderId(providerId)
          ? MANAGED_PROVIDER_NAME
          : providerMap.get(providerId)?.name || t('settings.ai.unknownChannel'),
        models: providerModels,
      }))
  }, [categoryFilteredModels, providers, t])

  const showGroupedSections = groupedFilteredModels.length > 1
    || groupedFilteredModels.some((group) => !isManagedProviderId(group.providerId))
  const emptyStateText = visibleActiveCategoryId === 'favorites'
    ? t('chat.noFavoriteModels')
    : t('chat.noModelsFound')

  const listRows = useMemo<ModelSelectorListRow[]>(() => {
    return groupedFilteredModels.flatMap((group) => {
      const rows: ModelSelectorListRow[] = []
      if (showGroupedSections) {
        rows.push({
          type: 'label',
          id: `label:${group.providerId}`,
          providerName: group.providerName,
        })
      }
      group.models.forEach((model) => {
        rows.push({
          type: 'model',
          id: model.id,
          model,
        })
      })
      return rows
    })
  }, [groupedFilteredModels, showGroupedSections])

  const visibleModelIds = useMemo(
    () => listRows.flatMap((row) => (row.type === 'model' ? [row.model.id] : [])),
    [listRows],
  )

  return {
    selectedModel,
    modelCategories,
    visibleActiveCategoryId,
    sortedFilteredModels,
    emptyStateText,
    listRows,
    visibleModelIds,
  }
}
