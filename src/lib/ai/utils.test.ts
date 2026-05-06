import { describe, expect, it } from 'vitest'
import { generateModelGroup } from './utils'

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
})
