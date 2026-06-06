import { describe, expect, it } from 'vitest'
import { MAX_MODEL_CAPABILITY_FIELD_CHARS, MAX_MODEL_CAPABILITY_TEXT_CHARS, isStandaloneImageGenerationModel, normalizeModelCapabilityText } from './modelCapabilities'

describe('model capabilities', () => {
  it('normalizes image model capability text for common separators', () => {
    expect(normalizeModelCapabilityText('OpenAI/GPT_Image_2')).toBe('openai-gpt-image-2')
    expect(isStandaloneImageGenerationModel({ apiModelId: 'google/IMAGEN-4.0-generate-preview', name: 'Imagen 4' })).toBe(true)
  })

  it('bounds capability normalization input', () => {
    const normalized = normalizeModelCapabilityText(`${'x'.repeat(MAX_MODEL_CAPABILITY_TEXT_CHARS)}-gpt-image-2`)

    expect(normalized).toBe('x'.repeat(MAX_MODEL_CAPABILITY_TEXT_CHARS))
  })

  it('ignores image model hints beyond the bounded field scan window', () => {
    expect(isStandaloneImageGenerationModel({
      apiModelId: `${'x'.repeat(MAX_MODEL_CAPABILITY_FIELD_CHARS)}-gpt-image-2`,
      name: 'plain',
    })).toBe(false)
  })
})
