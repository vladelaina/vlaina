import type { AIModel } from '@/lib/ai/types'

const MAX_MODEL_SELECTOR_SEARCH_QUERY_CHARS = 256
const MAX_MODEL_SELECTOR_SEARCH_FIELD_CHARS = 4096

export function getModelSelectorSearchTerm(searchQuery: string): string {
  return searchQuery.slice(0, MAX_MODEL_SELECTOR_SEARCH_QUERY_CHARS).trim().toLowerCase()
}

function getModelSelectorSearchField(value: string | undefined): string {
  return (value ?? '').slice(0, MAX_MODEL_SELECTOR_SEARCH_FIELD_CHARS).toLowerCase()
}

function compactModelSelectorSearchText(value: string): string {
  return value.replace(/[^a-z0-9]+/g, '')
}

export function modelMatchesSelectorSearch(model: Pick<AIModel, 'name' | 'apiModelId'>, term: string): boolean {
  const compactTerm = compactModelSelectorSearchText(term)
  const name = getModelSelectorSearchField(model.name)
  const apiModelId = getModelSelectorSearchField(model.apiModelId)

  return (
    name.includes(term) ||
    apiModelId.includes(term) ||
    (compactTerm.length > 0 && (
      compactModelSelectorSearchText(name).includes(compactTerm) ||
      compactModelSelectorSearchText(apiModelId).includes(compactTerm)
    ))
  )
}
