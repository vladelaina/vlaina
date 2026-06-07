import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedData } from './unifiedStorage';

const mocks = vi.hoisted(() => ({
  storage: {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn(),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    listDir: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  },
  joinPath: vi.fn(),
  hasElectronDesktopBridge: vi.fn(() => false),
  getProviderSecrets: vi.fn().mockResolvedValue({}),
  setProviderSecret: vi.fn().mockResolvedValue(undefined),
  deleteProviderSecret: vi.fn().mockResolvedValue(undefined),
  addToast: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  joinPath: mocks.joinPath,
}));

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: mocks.hasElectronDesktopBridge,
}));

vi.mock('@/lib/desktop/secretsCommands', () => ({
  aiProviderSecretCommands: {
    getProviderSecrets: mocks.getProviderSecrets,
    setProviderSecret: mocks.setProviderSecret,
    deleteProviderSecret: mocks.deleteProviderSecret,
  },
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mocks.addToast }),
  },
}));

import {
  MAX_AI_PROVIDER_CHANNEL_BENCHMARK_ITEMS,
  loadUnifiedData,
  saveUnifiedDataImmediate,
  setUnifiedStorageAutoSyncTrigger,
} from './unifiedStorage';

const mainDataFile = {
  version: 2,
  lastModified: 1,
  data: {
    settings: {
      timezone: { offset: 480, city: 'Beijing' },
      markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
    },
    customIcons: [],
  },
};

function createProviderChannel(benchmarkResults: unknown) {
  return {
    version: 1,
    providerId: 'provider-1',
    updatedAt: 1,
    data: {
      provider: {
        id: 'provider-1',
        name: 'Provider',
        type: 'newapi',
        apiHost: 'https://provider.example',
        apiKey: '',
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      },
      models: [],
      benchmarkResults,
      fetchedModels: [],
    },
  };
}

function setupBenchmarkLoad(benchmarkResults: unknown) {
  mocks.storage.exists.mockImplementation(async (path: string) => (
    path.endsWith('/.vlaina/data.json') ||
    path.endsWith('/chat/sessions.json') ||
    path.endsWith('/chat/channels/provider-1.json')
  ));
  mocks.storage.readFile.mockImplementation(async (path: string) => {
    if (path.endsWith('/.vlaina/data.json')) {
      return JSON.stringify(mainDataFile);
    }

    if (path.endsWith('/chat/sessions.json')) {
      return JSON.stringify({
        version: 1,
        updatedAt: 1,
        data: {
          sessions: [],
          providerIds: ['provider-1'],
        },
      });
    }

    if (path.endsWith('/chat/channels/provider-1.json')) {
      return JSON.stringify(createProviderChannel(benchmarkResults));
    }

    throw new Error(`Unexpected read: ${path}`);
  });
}

function createDataForSave(benchmarkResults: unknown): UnifiedData {
  return {
    settings: {
      timezone: { offset: 480, city: 'Beijing' },
      markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
    },
    customIcons: [],
    ai: {
      providers: [{
        id: 'provider-1',
        name: 'Provider',
        type: 'newapi',
        apiHost: 'https://provider.example',
        apiKey: '',
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      }],
      models: [],
      benchmarkResults: {
        'provider-1': benchmarkResults,
      } as never,
      fetchedModels: {},
      sessions: [],
      messages: {},
      unreadSessionIds: [],
      selectedModelId: null,
      currentSessionId: null,
    },
  };
}

describe('unifiedStorage provider benchmark bounds', () => {
  beforeEach(() => {
    setUnifiedStorageAutoSyncTrigger(null);
    mocks.storage.getBasePath.mockClear();
    mocks.storage.exists.mockReset();
    mocks.storage.mkdir.mockClear();
    mocks.storage.readFile.mockReset();
    mocks.storage.stat.mockReset();
    mocks.storage.writeFile.mockClear();
    mocks.storage.listDir.mockReset();
    mocks.storage.deleteFile.mockClear();
    mocks.joinPath.mockReset();
    mocks.getProviderSecrets.mockClear();
    mocks.setProviderSecret.mockClear();
    mocks.deleteProviderSecret.mockClear();
    mocks.addToast.mockClear();
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 1024 });
    mocks.storage.listDir.mockResolvedValue([]);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return JSON.stringify(mainDataFile);
      }

      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          version: 1,
          updatedAt: 1,
          data: {
            sessions: [],
            selectedModelId: null,
            unreadSessionIds: [],
            currentSessionId: null,
            temporaryChatEnabled: false,
            customSystemPrompt: '',
            includeTimeContext: true,
            webSearchEnabled: false,
            providerIds: [],
            deletedSessionIds: [],
            deletedProviderIds: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });
  });

  it('normalizes provider benchmark records restored from channel files', async () => {
    const longError = `${'e'.repeat(4096)}x`;
    const itemsWithUnsafeKey = {
      'model-ok': { status: 'success', latency: 120, checkedAt: 10 },
      'model-bad-status': { status: 'loading', checkedAt: 11 },
      'model-bad-latency': { status: 'success', latency: Number.POSITIVE_INFINITY, checkedAt: 12 },
      'model-long-error': { status: 'error', error: longError, checkedAt: 13 },
      ['__proto__']: { status: 'error', checkedAt: 14 },
    };
    setupBenchmarkLoad({
      items: itemsWithUnsafeKey,
      overall: 'broken',
      updatedAt: 20,
    });

    const data = await loadUnifiedData();
    const record = data.ai?.benchmarkResults?.['provider-1'];

    expect(record?.overall).toBe('error');
    expect(record?.updatedAt).toBe(20);
    expect(Object.keys(record?.items || {})).toEqual([
      'model-ok',
      'model-bad-latency',
      'model-long-error',
    ]);
    expect(record?.items['model-ok']).toEqual({ status: 'success', latency: 120, checkedAt: 10 });
    expect(record?.items['model-bad-latency']).toEqual({ status: 'success', checkedAt: 12 });
    expect(record?.items['model-long-error']?.error).toHaveLength(4096);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('drops malformed provider benchmark records restored from channel files', async () => {
    setupBenchmarkLoad({
      items: null,
      overall: 'error',
      updatedAt: 'bad',
    });

    const data = await loadUnifiedData();

    expect(data.ai?.benchmarkResults).toEqual({});
  });

  it('bounds provider benchmark records restored from channel files', async () => {
    setupBenchmarkLoad({
      items: Object.fromEntries(
        Array.from({ length: MAX_AI_PROVIDER_CHANNEL_BENCHMARK_ITEMS + 1 }, (_, index) => [
          `model-${index}`,
          { status: 'success', checkedAt: index },
        ]),
      ),
      overall: 'success',
      updatedAt: 1,
    });

    const data = await loadUnifiedData();

    expect(Object.keys(data.ai?.benchmarkResults?.['provider-1']?.items || {})).toHaveLength(
      MAX_AI_PROVIDER_CHANNEL_BENCHMARK_ITEMS,
    );
    expect(data.ai?.benchmarkResults?.['provider-1']?.items['model-1999']).toEqual({
      status: 'success',
      checkedAt: 1999,
    });
    expect(data.ai?.benchmarkResults?.['provider-1']?.items['model-2000']).toBeUndefined();
  });

  it('normalizes provider benchmark records before saving channel files', async () => {
    await saveUnifiedDataImmediate(createDataForSave({
      items: {
        'model-ok': { status: 'success', latency: 50, checkedAt: 1 },
        'model-invalid': { status: 'loading', checkedAt: 2 },
      },
      overall: 'wat',
      updatedAt: 3,
    }));

    const channelWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/channels/provider-1.json'),
    );
    const payload = JSON.parse(String(channelWrite?.[1]));

    expect(payload.data.benchmarkResults).toEqual({
      items: {
        'model-ok': { status: 'success', latency: 50, checkedAt: 1 },
      },
      overall: 'success',
      updatedAt: 3,
    });
  });

  it('drops malformed provider benchmark records before saving channel files', async () => {
    await saveUnifiedDataImmediate(createDataForSave({
      items: null,
      overall: 'error',
      updatedAt: 1,
    }));

    const channelWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/channels/provider-1.json'),
    );
    const payload = JSON.parse(String(channelWrite?.[1]));

    expect(payload.data).not.toHaveProperty('benchmarkResults');
  });
});
