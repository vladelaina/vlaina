import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions } from './providerActions';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import type { AIModel, Provider } from '@/lib/ai/types';

const { fetchManagedModelsMock } = vi.hoisted(() => ({
  fetchManagedModelsMock: vi.fn(),
}));

let managedRefreshTestNow = 1_700_000_000_000;

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

vi.mock('@/lib/ai/managedService', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/managedService')>('@/lib/ai/managedService');
  return {
    ...actual,
    fetchManagedModels: fetchManagedModelsMock,
  };
});

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
    fetchManagedModelsMock.mockReset();
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

describe('refreshManagedProviderInBackground', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    managedRefreshTestNow += 10 * 60 * 1000;
    vi.setSystemTime(managedRefreshTestNow);
    fetchManagedModelsMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    seedAI([
      buildProvider({
        id: 'vlaina-managed',
        name: 'vlaina',
        type: 'newapi',
        apiHost: 'https://api.vlaina.com/v1',
      }),
    ], [
      buildModel({
        id: 'vlaina-managed::old-model',
        apiModelId: 'old-model',
        name: 'Old Model',
        providerId: 'vlaina-managed',
      }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('keeps the existing managed models when background refresh fails', async () => {
    fetchManagedModelsMock.mockRejectedValue(new Error('network failed'));

    actions.refreshManagedProviderInBackground();
    await vi.runAllTimersAsync();

    expect(useUnifiedStore.getState().data.ai?.models.map((model) => model.apiModelId)).toEqual(['old-model']);
  });

  it('deduplicates rapid background refresh attempts', async () => {
    fetchManagedModelsMock.mockResolvedValue([
      buildModel({
        id: 'vlaina-managed::new-model',
        apiModelId: 'new-model',
        name: 'New Model',
        providerId: 'vlaina-managed',
      }),
    ]);

    actions.refreshManagedProviderInBackground();
    actions.refreshManagedProviderInBackground();
    await vi.runAllTimersAsync();

    expect(fetchManagedModelsMock).toHaveBeenCalledTimes(1);
    expect(useUnifiedStore.getState().data.ai?.models.map((model) => model.apiModelId)).toEqual(['new-model']);
  });
});

describe('addModels', () => {
  beforeEach(() => {
    fetchManagedModelsMock.mockReset();
    seedAI([buildProvider({ id: 'provider-1' })], [
      buildModel({
        id: 'provider-1::gpt-existing',
        apiModelId: 'gpt-existing',
      }),
    ]);
  });

  it('adds only models that are not already present or duplicated in the batch', () => {
    actions.addModels([
      {
        id: 'ignored',
        apiModelId: 'gpt-existing',
        name: 'Existing',
        providerId: 'provider-1',
        enabled: true,
      },
      {
        id: 'ignored',
        apiModelId: 'gpt-new',
        name: 'New',
        providerId: 'provider-1',
        enabled: true,
      },
      {
        id: 'ignored',
        apiModelId: 'gpt-new',
        name: 'New Duplicate',
        providerId: 'provider-1',
        enabled: true,
      },
    ]);

    expect(useUnifiedStore.getState().data.ai?.models.map((model) => model.apiModelId)).toEqual([
      'gpt-existing',
      'gpt-new',
    ]);
  });
});
