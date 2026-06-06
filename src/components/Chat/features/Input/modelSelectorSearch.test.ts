import { describe, expect, it } from 'vitest'
import type { AIModel } from '@/lib/ai/types'
import { getModelSelectorSearchTerm, modelMatchesSelectorSearch } from './modelSelectorSearch'

function createModel(apiModelId: string, name = apiModelId): AIModel {
  return {
    id: `provider-1::${apiModelId}`,
    apiModelId,
    name,
    providerId: 'provider-1',
    enabled: true,
    createdAt: 1,
  }
}

describe('model selector search', () => {
  it('matches normal model names and ids case-insensitively', () => {
    expect(modelMatchesSelectorSearch(createModel('openai/gpt-5'), getModelSelectorSearchTerm('GPT'))).toBe(true)
    expect(modelMatchesSelectorSearch(createModel('provider/model-a', 'Friendly Name'), getModelSelectorSearchTerm('friendly'))).toBe(true)
    expect(modelMatchesSelectorSearch(createModel('provider/model-a'), getModelSelectorSearchTerm('missing'))).toBe(false)
  })

  it('bounds the user search term used for filtering', () => {
    const term = getModelSelectorSearchTerm(`${'x'.repeat(256)}needle`)

    expect(term).toHaveLength(256)
    expect(term).not.toContain('needle')
  })

  it('ignores provider model text beyond the bounded scan window', () => {
    const lateNameMatch = createModel('provider/model-a', `${'x'.repeat(4096)}needle`)
    const lateIdMatch = createModel(`${'x'.repeat(4096)}needle`)

    expect(modelMatchesSelectorSearch(lateNameMatch, getModelSelectorSearchTerm('needle'))).toBe(false)
    expect(modelMatchesSelectorSearch(lateIdMatch, getModelSelectorSearchTerm('needle'))).toBe(false)
  })
})
