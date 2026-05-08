import { describe, expect, it } from 'vitest'
import type { AIModel } from '@/lib/ai/types'
import { sortModelsForDisplay } from './modelSort'

function model(apiModelId: string, name = apiModelId): AIModel {
  return {
    id: apiModelId,
    apiModelId,
    name,
    providerId: 'provider',
    enabled: true,
    createdAt: 0,
  }
}

describe('modelSort', () => {
  it('puts newer model generations before older generations', () => {
    const sorted = sortModelsForDisplay([
      model('gemini-1.5-pro'),
      model('gemini-2.0-pro'),
      model('gemini-2.5-pro'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'gemini-2.5-pro',
      'gemini-2.0-pro',
      'gemini-1.5-pro',
    ])
  })

  it('puts pro class models before flash class models within the same generation', () => {
    const sorted = sortModelsForDisplay([
      model('gemini-2.5-flash'),
      model('gemini-2.5-pro'),
      model('gemini-2.5-flash-lite'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ])
  })

  it('puts larger parameter variants before smaller variants within the same family', () => {
    const sorted = sortModelsForDisplay([
      model('qwen3-32b'),
      model('qwen3-235b-a22b'),
      model('qwen3-8b'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'qwen3-235b-a22b',
      'qwen3-32b',
      'qwen3-8b',
    ])
  })

  it('keeps known capability tiers ahead of lightweight variants', () => {
    const sorted = sortModelsForDisplay([
      model('claude-3-5-haiku-20241022'),
      model('claude-3-5-sonnet-20241022'),
      model('claude-3-opus-20240229'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ])
  })

  it('uses release dates without treating them as model generations', () => {
    const sorted = sortModelsForDisplay([
      model('claude-3-5-sonnet-20240620'),
      model('claude-3-5-sonnet-20241022'),
      model('claude-3-5-sonnet-20240307'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'claude-3-5-sonnet-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-5-sonnet-20240307',
    ])
  })

  it('recognizes short month-year and month-day model suffixes', () => {
    const sorted = sortModelsForDisplay([
      model('deepseek-r1-0120'),
      model('deepseek-r1-0528'),
      model('kimi-k2-0711-preview'),
      model('kimi-k2-0905-preview'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'kimi-k2-0905-preview',
      'kimi-k2-0711-preview',
      'deepseek-r1-0528',
      'deepseek-r1-0120',
    ])
  })

  it('keeps stable and latest routes above preview and free variants', () => {
    const sorted = sortModelsForDisplay([
      model('openai/gpt-4o:free'),
      model('openai/gpt-4o-2024-11-20'),
      model('openai/gpt-4o:latest'),
      model('openai/gpt-4o-preview'),
      model('openai/gpt-4o'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'openai/gpt-4o:latest',
      'openai/gpt-4o',
      'openai/gpt-4o-2024-11-20',
      'openai/gpt-4o-preview',
      'openai/gpt-4o:free',
    ])
  })

  it('sorts larger context-window variants first without treating context as generation', () => {
    const sorted = sortModelsForDisplay([
      model('claude-sonnet-4-128k'),
      model('claude-sonnet-4-1m'),
      model('claude-sonnet-4-32k'),
    ])

    expect(sorted.map((item) => item.apiModelId)).toEqual([
      'claude-sonnet-4-1m',
      'claude-sonnet-4-128k',
      'claude-sonnet-4-32k',
    ])
  })
})
