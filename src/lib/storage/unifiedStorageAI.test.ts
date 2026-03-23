import { describe, expect, it } from 'vitest';

import type { AIModel, ChatSession, Provider } from '@/lib/ai/types';

import { normalizeLoadedAIModels } from './unifiedStorageAI';

const providers: Provider[] = [
  {
    id: 'nekotick-managed',
    name: 'NekoTick AI',
    type: 'newapi',
    apiHost: 'https://api.nekotick.com/v1',
    apiKey: '',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
  },
];

const models: AIModel[] = [
  {
    id: 'nekotick-managed::gpt-5.4',
    apiModelId: 'gpt-5.4',
    name: 'GPT-5.4',
    providerId: 'nekotick-managed',
    enabled: true,
    createdAt: 1,
  },
];

describe('normalizeLoadedAIModels', () => {
  it('keeps a current scoped model id when it is available', () => {
    const sessions: ChatSession[] = [
      {
        id: 'session-1',
        title: 'Test',
        modelId: 'nekotick-managed::gpt-5.4',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const normalized = normalizeLoadedAIModels(
      providers,
      models,
      'nekotick-managed::gpt-5.4',
      sessions
    );

    expect(normalized.selectedModelId).toBe('nekotick-managed::gpt-5.4');
    expect(normalized.sessions[0]?.modelId).toBe('nekotick-managed::gpt-5.4');
  });

  it('drops unknown model ids instead of guessing', () => {
    const additionalModels: AIModel[] = [
      {
        id: 'nekotick-managed::gpt-5.4@openrouter-a',
        apiModelId: 'gpt-5.4@openrouter-a',
        name: 'GPT-5.4 A',
        providerId: 'nekotick-managed',
        enabled: true,
        createdAt: 1,
      },
      {
        id: 'nekotick-managed::gpt-5.4@openrouter-b',
        apiModelId: 'gpt-5.4@openrouter-b',
        name: 'GPT-5.4 B',
        providerId: 'nekotick-managed',
        enabled: true,
        createdAt: 1,
      },
    ];

    const normalized = normalizeLoadedAIModels(
      providers,
      additionalModels,
      'nekotick-managed::ch_a90e79128fec49ea8aae57b140dca404::gpt-5.4',
      []
    );

    expect(normalized.selectedModelId).toBeNull();
  });
});
