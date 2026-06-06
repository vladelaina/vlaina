import { describe, expect, it } from 'vitest';

import type { AIModel, ChatSession, Provider } from '@/lib/ai/types';

import {
  MAX_LOADED_AI_FIELD_CHARS,
  MAX_LOADED_AI_NAME_CHARS,
  MAX_LOADED_AI_PROVIDERS,
  isSafeChatSessionId,
  isSafeProviderId,
  normalizeLoadedAIModels,
  normalizeLoadedAIProviders,
} from './unifiedStorageAI';

const providers: Provider[] = [
  {
    id: 'vlaina-managed',
    name: 'vlaina AI',
    type: 'newapi',
    apiHost: 'https://api.vlaina.com/v1',
    apiKey: '',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
  },
];

const models: AIModel[] = [
  {
    id: 'vlaina-managed::gpt-5.4',
    apiModelId: 'gpt-5.4',
    name: 'GPT-5.4',
    providerId: 'vlaina-managed',
    enabled: true,
    createdAt: 1,
  },
];

describe('normalizeLoadedAIModels', () => {
  it('sanitizes malformed providers before they enter request and secret-loading paths', () => {
    const normalized = normalizeLoadedAIProviders([
      {
        id: ' provider-1 ',
        name: '',
        type: 'legacy',
        apiHost: ' https://api.example.com/v1 ',
        apiKey: 'sk-test',
        endpointType: 'anthropic',
        endpointTypeCheckedAt: 12,
        enabled: undefined,
        createdAt: 'bad',
        updatedAt: 9,
      },
      { id: 'provider-1', name: 'Duplicate', apiHost: 'https://duplicate.example' },
      { id: '../outside', name: 'Path Traversal', apiHost: 'https://outside.example' },
      { id: 'provider/slash', name: 'Slash', apiHost: 'https://slash.example' },
      { name: 'Missing ID', apiHost: 'https://missing.example' },
      null,
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]).toMatchObject({
      id: 'provider-1',
      name: 'Custom Provider',
      type: 'newapi',
      apiHost: 'https://api.example.com/v1',
      apiKey: 'sk-test',
      endpointType: 'anthropic',
      endpointTypeCheckedAt: 12,
      enabled: true,
      updatedAt: 9,
    });
    expect(Number.isFinite(normalized[0]?.createdAt)).toBe(true);
  });

  it('accepts only provider ids that are safe to use as channel filenames', () => {
    expect(isSafeProviderId('provider-123_ABC.v1')).toBe(true);
    expect(isSafeProviderId('vlaina-managed')).toBe(true);
    expect(isSafeProviderId('../provider')).toBe(false);
    expect(isSafeProviderId('provider/name')).toBe(false);
    expect(isSafeProviderId('provider\\name')).toBe(false);
    expect(isSafeProviderId('-leading-dash')).toBe(false);
    expect(isSafeProviderId('')).toBe(false);
  });

  it('accepts only chat session ids that are safe to use as session filenames', () => {
    expect(isSafeChatSessionId('session-123_ABC.v1')).toBe(true);
    expect(isSafeChatSessionId('temp-session-123')).toBe(true);
    expect(isSafeChatSessionId('../session')).toBe(false);
    expect(isSafeChatSessionId('session/name')).toBe(false);
    expect(isSafeChatSessionId('session\\name')).toBe(false);
    expect(isSafeChatSessionId('-leading-dash')).toBe(false);
    expect(isSafeChatSessionId('')).toBe(false);
  });

  it('keeps a current scoped model id when it is available', () => {
    const sessions: ChatSession[] = [
      {
        id: 'session-1',
        title: 'Test',
        modelId: 'vlaina-managed::gpt-5.4',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const normalized = normalizeLoadedAIModels(
      providers,
      models,
      'vlaina-managed::gpt-5.4',
      sessions
    );

    expect(normalized.selectedModelId).toBe('vlaina-managed::gpt-5.4');
    expect(normalized.sessions[0]?.modelId).toBe('vlaina-managed::gpt-5.4');
  });

  it('drops unknown model ids instead of guessing', () => {
    const additionalModels: AIModel[] = [
      {
        id: 'vlaina-managed::gpt-5.4@openrouter-a',
        apiModelId: 'gpt-5.4@openrouter-a',
        name: 'GPT-5.4 A',
        providerId: 'vlaina-managed',
        enabled: true,
        createdAt: 1,
      },
      {
        id: 'vlaina-managed::gpt-5.4@openrouter-b',
        apiModelId: 'gpt-5.4@openrouter-b',
        name: 'GPT-5.4 B',
        providerId: 'vlaina-managed',
        enabled: true,
        createdAt: 1,
      },
    ];

    const normalized = normalizeLoadedAIModels(
      providers,
      additionalModels,
      'vlaina-managed::ch_a90e79128fec49ea8aae57b140dca404::gpt-5.4',
      []
    );

    expect(normalized.selectedModelId).toBeNull();
  });

  it('sanitizes malformed model and session records without guessing unknown ids', () => {
    const normalized = normalizeLoadedAIModels(
      providers,
      [
        {
          id: 'stale-id',
          apiModelId: ' model-a ',
          name: '',
          providerId: 'vlaina-managed',
          priceTier: '$$$',
          priceScore: 1.4,
          enabled: undefined,
          createdAt: 'bad',
        },
        {
          apiModelId: 'missing-provider',
          providerId: 'unknown-provider',
        },
        {
          apiModelId: '',
          providerId: 'vlaina-managed',
        },
      ],
      'stale-id',
      [
        {
          id: ' session-1 ',
          title: '',
          modelId: 'vlaina-managed::model-a',
          createdAt: 'bad',
          updatedAt: 5,
        },
        {
          id: 'session-1',
          title: 'Duplicate',
          modelId: 'vlaina-managed::model-a',
        },
        {
          id: '../outside',
          title: 'Unsafe',
          modelId: 'vlaina-managed::model-a',
        },
        {
          title: 'Missing ID',
          modelId: 'vlaina-managed::model-a',
        },
      ],
    );

    expect(normalized.selectedModelId).toBeNull();
    expect(normalized.models).toHaveLength(1);
    expect(normalized.models[0]).toMatchObject({
      id: 'vlaina-managed::model-a',
      apiModelId: 'model-a',
      name: 'Model A',
      providerId: 'vlaina-managed',
      priceTier: '$$$',
      priceScore: 1.4,
      enabled: true,
    });
    expect(Number.isFinite(normalized.models[0]?.createdAt)).toBe(true);
    expect(normalized.sessions).toHaveLength(1);
    expect(normalized.sessions[0]).toMatchObject({
      id: 'session-1',
      title: 'New Chat',
      modelId: 'vlaina-managed::model-a',
      updatedAt: 5,
    });
    expect(Number.isFinite(normalized.sessions[0]?.createdAt)).toBe(true);
  });

  it('bounds loaded model and session normalization', () => {
    const normalized = normalizeLoadedAIModels(
      providers,
      Array.from({ length: 10_050 }, (_, index) => ({
        apiModelId: `model-${index}`,
        providerId: 'vlaina-managed',
      })),
      'vlaina-managed::model-9999',
      Array.from({ length: 5_050 }, (_, index) => ({
        id: `session-${index}`,
        title: `Session ${index}`,
        modelId: 'vlaina-managed::model-0',
      })),
    );

    expect(normalized.models).toHaveLength(10_000);
    expect(normalized.models[0]?.id).toBe('vlaina-managed::model-0');
    expect(normalized.models.at(-1)?.id).toBe('vlaina-managed::model-9999');
    expect(normalized.selectedModelId).toBe('vlaina-managed::model-9999');
    expect(normalized.sessions).toHaveLength(5_000);
    expect(normalized.sessions[0]?.id).toBe('session-0');
    expect(normalized.sessions.at(-1)?.id).toBe('session-4999');
  });

  it('bounds loaded provider records and string fields', () => {
    const normalized = normalizeLoadedAIProviders(
      Array.from({ length: MAX_LOADED_AI_PROVIDERS + 10 }, (_, index) => ({
        id: `provider-${index}`,
        name: `${'n'.repeat(MAX_LOADED_AI_NAME_CHARS)}x`,
        apiHost: `${'h'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`,
        apiKey: `${'k'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`,
        icon: `${'i'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`,
      })),
    );

    expect(normalized).toHaveLength(MAX_LOADED_AI_PROVIDERS);
    expect(normalized[0]?.id).toBe('provider-0');
    expect(normalized.at(-1)?.id).toBe(`provider-${MAX_LOADED_AI_PROVIDERS - 1}`);
    expect(normalized[0]?.name).toHaveLength(MAX_LOADED_AI_NAME_CHARS);
    expect(normalized[0]?.apiHost).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
    expect(normalized[0]?.apiKey).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
    expect(normalized[0]?.icon).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
  });

  it('bounds loaded model and session string fields', () => {
    const provider = normalizeLoadedAIProviders([{
      id: 'provider-1',
      name: 'Provider',
      apiHost: 'https://api.example.test',
      apiKey: '',
    }]);
    const longApiModelId = `${'m'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`;
    const longName = `${'n'.repeat(MAX_LOADED_AI_NAME_CHARS)}x`;
    const longGroup = `${'g'.repeat(MAX_LOADED_AI_NAME_CHARS)}x`;
    const longSessionTitle = `${'t'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`;
    const longSessionModelId = `${'s'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`;

    const normalized = normalizeLoadedAIModels(
      provider,
      [{
        apiModelId: longApiModelId,
        name: longName,
        group: longGroup,
        providerId: 'provider-1',
      }],
      null,
      [{
        id: 'session-1',
        title: longSessionTitle,
        modelId: longSessionModelId,
      }],
    );

    expect(normalized.models).toHaveLength(1);
    expect(normalized.models[0]?.apiModelId).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
    expect(normalized.models[0]?.name).toHaveLength(MAX_LOADED_AI_NAME_CHARS);
    expect(normalized.models[0]?.group).toHaveLength(MAX_LOADED_AI_NAME_CHARS);
    expect(normalized.sessions).toHaveLength(1);
    expect(normalized.sessions[0]?.title).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
    expect(normalized.sessions[0]?.modelId).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
  });
});
