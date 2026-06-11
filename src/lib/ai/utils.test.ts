import { describe, expect, it } from 'vitest'
import {
  MAX_GENERATED_MODEL_NAME_PARTS,
  MAX_MODEL_ID_DERIVATION_CHARS,
  buildAnthropicBaseUrl,
  buildOpenAIBaseUrl,
  generateModelGroup,
  generateModelName,
  normalizeApiHost,
} from './utils'

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

  it('normalizes explicit provider API hosts', () => {
    expect(normalizeApiHost(' https://api.example.com/v1/ ')).toBe('https://api.example.com/v1')
    expect(normalizeApiHost('http://localhost:11434/api')).toBe('http://localhost:11434/api')
    expect(buildOpenAIBaseUrl('https://api.example.com/v1/chat/completions')).toBe('https://api.example.com/v1')
    expect(buildAnthropicBaseUrl('https://api.example.com/v1/messages')).toBe('https://api.example.com/v1')
  })

  it('rejects unsupported provider API hosts before endpoint construction', () => {
    const unsafeHosts = [
      '',
      'https:api.example.com/v1',
      'http:/api.example.com/v1',
      'ftp://api.example.com/v1',
      'https://user:pass@api.example.com/v1',
      'https://api.example.com\\@evil.example/v1',
      'https://api.example.com/v1?api_key=secret',
      'https://api.example.com/v1#models',
      'https://api.example.com/\u202Ecod.exe',
    ]

    for (const host of unsafeHosts) {
      expect(() => normalizeApiHost(host)).toThrow('AI provider API host is not supported.')
      expect(() => buildOpenAIBaseUrl(host)).toThrow('AI provider API host is not supported.')
    }
  })
})
