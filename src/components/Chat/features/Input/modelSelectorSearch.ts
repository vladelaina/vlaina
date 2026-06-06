import type { AIModel } from '@/lib/ai/types'

const MAX_MODEL_SELECTOR_SEARCH_QUERY_CHARS = 256
const MAX_MODEL_SELECTOR_SEARCH_FIELD_CHARS = 4096

export function getModelSelectorSearchTerm(searchQuery: string): string {
  return searchQuery.slice(0, MAX_MODEL_SELECTOR_SEARCH_QUERY_CHARS).toLowerCase()
}

function getModelSelectorSearchField(value: string | undefined): string {
  return (value ?? '').slice(0, MAX_MODEL_SELECTOR_SEARCH_FIELD_CHARS).toLowerCase()
}

export function modelMatchesSelectorSearch(model: Pick<AIModel, 'name' | 'apiModelId'>, term: string): boolean {
  return (
    getModelSelectorSearchField(model.name).includes(term) ||
    getModelSelectorSearchField(model.apiModelId).includes(term)
  )
}
