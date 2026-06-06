import { describe, expect, it } from 'vitest'
import { MAX_GENERATED_MODEL_NAME_PARTS, MAX_MODEL_ID_DERIVATION_CHARS, generateModelGroup, generateModelName } from './utils'

describe('AI model utilities', () => {
  it('generates groups for common model families', () => {
    expect(generateModelGroup('longcat-flash-chat')).toBe('LongCat')
    expect(generateModelGroup('long-cat-flash-chat')).toBe('LongCat')
    expect(generateModelGroup('google/gemma-3-27b-it')).toBe('Gemma')
    expect(generateModelGroup('meta-llama/llama-3.3-70b-instruct')).toBe('Llama')
    expect(generateModelGroup('llama3.1:8b')).toBe('Llama')
    expect(generateModelGroup('liama-3-local')).toBe('Llama')
  })

  it('does not treat Ollama provider names as Llama models', () => {
    expect(generateModelGroup('ollama-local-model')).toBe('Ollama')
  })

  it('bounds generated model names from provider-controlled ids', () => {
    const name = generateModelName(Array.from({ length: MAX_GENERATED_MODEL_NAME_PARTS + 5 }, (_, index) => `part${index}`).join('-'))

    expect(name.split(' ')).toHaveLength(MAX_GENERATED_MODEL_NAME_PARTS)
    expect(name).not.toContain(`Part${MAX_GENERATED_MODEL_NAME_PARTS}`)
  })

  it('ignores model group hints beyond the bounded derivation scan window', () => {
    expect(generateModelGroup(`${'x'.repeat(MAX_MODEL_ID_DERIVATION_CHARS)}-gpt-5`)).toBe(`X${'x'.repeat(MAX_MODEL_ID_DERIVATION_CHARS - 1)}`)
  })
})
