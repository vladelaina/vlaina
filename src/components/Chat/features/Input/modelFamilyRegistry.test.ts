import { describe, expect, it } from 'vitest'
import type { AIModel } from '@/lib/ai/types'
import { MODEL_FAMILIES, getModelCategoryId, getModelDisplayName } from './modelFamilyRegistry'

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

describe('model family registry', () => {
  it('keeps the primary family order used by the model selector', () => {
    expect(MODEL_FAMILIES.slice(0, 14).map((family) => family.id)).toEqual([
      'openai',
      'anthropic',
      'gemini',
      'grok',
      'deepseek',
      'qwen',
      'moonshot',
      'zhipu',
      'minimax',
      'doubao',
      'gemma',
      'llama',
      'longcat',
      'mimo',
    ])
  })

  it('groups GPT models from names and provider-scoped ids into OpenAI', () => {
    expect(getModelCategoryId(createModel('openai/gpt-5'))).toBe('openai')
    expect(getModelCategoryId(createModel('custom-model', 'gpt5'))).toBe('openai')
  })

  it('keeps unmatched user-defined models in custom', () => {
    expect(getModelCategoryId(createModel('my-private-model'))).toBe('custom')
  })

  it('groups Xiaomi MiMo models separately', () => {
    expect(getModelCategoryId(createModel('mimo-v2.5-pro'))).toBe('mimo')
    expect(getModelCategoryId(createModel('xiaomi/mimo-tts'))).toBe('mimo')
  })

  it('groups LongCat, Gemma, and Llama models separately', () => {
    expect(getModelCategoryId(createModel('longcat-flash-chat'))).toBe('longcat')
    expect(getModelCategoryId(createModel('google/gemma-3-27b-it'))).toBe('gemma')
    expect(getModelCategoryId(createModel('meta-llama/llama-3.3-70b-instruct'))).toBe('llama')
    expect(getModelCategoryId(createModel('llama3.1:8b'))).toBe('llama')
    expect(getModelCategoryId(createModel('liama-3-local'))).toBe('llama')
    expect(getModelCategoryId(createModel('ollama-local-model'))).toBe('custom')
  })

  it('removes known provider prefixes from display names', () => {
    expect(getModelDisplayName(createModel('openai/gpt-5'))).toBe('gpt-5')
    expect(getModelDisplayName(createModel('xiaomi/mimo-v2.5-pro'))).toBe('mimo-v2.5-pro')
    expect(getModelDisplayName(createModel('longcat/longcat-flash-chat'))).toBe('longcat-flash-chat')
  })

  it('keeps unknown prefixes in display names', () => {
    expect(getModelDisplayName(createModel('private-team/model-a'))).toBe('private-team/model-a')
  })
})
