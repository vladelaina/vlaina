import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actions } from './providerActions';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import type { AIModel, Provider } from '@/lib/ai/types';

vi.mock('@/lib/storage/unifiedStorage', () => ({
  loadUnifiedData: vi.fn(async () => ({
    settings: {},
    customIcons: [],
    ai: null,
  })),
  saveUnifiedData: vi.fn(),
}));

vi.mock('@/lib/storage/assetStorage', () => ({
  scanGlobalIcons: vi.fn(async () => []),
}));

function buildProvider(overrides: Partial<Provider>): Provider {
  return {
    id: 'provider-1',
    name: 'Channel 1',
    type: 'newapi',
    apiHost: '',
    apiKey: '',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function buildModel(overrides: Partial<AIModel>): AIModel {
  return {
    id: 'provider-1::gpt-test',
    apiModelId: 'gpt-test',
    name: 'GPT Test',
    providerId: 'provider-1',
    enabled: true,
    createdAt: 1,
    ...overrides,
  };
}

function seedAI(providers: Provider[], models: AIModel[] = []) {
  useUnifiedStore.setState({
    loaded: true,
    data: {
      settings: {} as never,
      customIcons: [],
      ai: {
        providers,
        models,
        benchmarkResults: {
          'provider-1': {
            items: {},
            overall: 'success',
            updatedAt: 1,
          },
        },
        fetchedModels: {
          'provider-1': ['gpt-test'],
        },
        sessions: [],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: models[0]?.id ?? null,
        currentSessionId: null,
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
      },
    },
  });
}

describe('deleteIncompleteCustomProviders', () => {
  beforeEach(() => {
    useUnifiedStore.setState({
      loaded: false,
      data: {
        settings: {} as never,
        customIcons: [],
        ai: {
          providers: [],
          models: [],
          benchmarkResults: {},
          fetchedModels: {},
          sessions: [],
          messages: {},
          unreadSessionIds: [],
          selectedModelId: null,
          currentSessionId: null,
          temporaryChatEnabled: false,
          customSystemPrompt: '',
          includeTimeContext: true,
        },
      },
    });
  });

  it('removes custom channels when both base url and api key are empty', () => {
    const model = buildModel({});
    seedAI([
      buildProvider({
        id: 'provider-1',
        name: 'Channel 1',
        apiHost: '',
        apiKey: '',
      }),
    ], [model]);

    actions.deleteIncompleteCustomProviders();

    const ai = useUnifiedStore.getState().data.ai!;
    expect(ai.providers).toEqual([]);
    expect(ai.models).toEqual([]);
    expect(ai.benchmarkResults).toEqual({});
    expect(ai.fetchedModels).toEqual({});
    expect(ai.selectedModelId).toBeNull();
  });

  it('keeps custom channels when the generated label was changed', () => {
    const provider = buildProvider({
      id: 'provider-1',
      name: 's',
      apiHost: '',
      apiKey: '',
    });
    seedAI([provider]);

    actions.deleteIncompleteCustomProviders();

    expect(useUnifiedStore.getState().data.ai?.providers).toEqual([provider]);
  });

  it('keeps custom channels when only api key is filled', () => {
    const provider = buildProvider({
      id: 'provider-1',
      name: 'Channel 1',
      apiHost: '',
      apiKey: 'sk-test',
    });
    seedAI([provider]);

    actions.deleteIncompleteCustomProviders();

    expect(useUnifiedStore.getState().data.ai?.providers).toEqual([provider]);
  });

  it('keeps custom channels when only base url is filled', () => {
    const provider = buildProvider({
      id: 'provider-1',
      name: 'Channel 1',
      apiHost: 'https://api.example.com',
      apiKey: '',
    });
    seedAI([provider]);

    actions.deleteIncompleteCustomProviders();

    expect(useUnifiedStore.getState().data.ai?.providers).toEqual([provider]);
  });

  it('keeps custom channels with base url and api key even when the label is unchanged', () => {
    const provider = buildProvider({
      id: 'provider-1',
      name: 'Channel 1',
      apiHost: 'https://api.example.com',
      apiKey: 'sk-test',
    });
    seedAI([provider]);

    actions.deleteIncompleteCustomProviders();

    expect(useUnifiedStore.getState().data.ai?.providers).toEqual([provider]);
  });
});
