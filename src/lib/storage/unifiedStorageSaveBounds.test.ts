import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  hasElectronDesktopBridge: vi.fn(() => true),
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
  MAX_AI_PROVIDER_FILE_SCAN_ENTRIES,
  MAX_AI_PROVIDER_FILE_BYTES,
  MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
  MAX_AI_SESSIONS_BYTES,
  MAX_CUSTOM_ICON_URL_CHARS,
  MAX_MAIN_DATA_BYTES,
  saveUnifiedDataImmediate,
  setUnifiedStorageAutoSyncTrigger,
} from './unifiedStorage';

function getWritePayload(pathSuffix: string): string {
  const call = mocks.storage.writeFile.mock.calls.find(([path]) => String(path).endsWith(pathSuffix));
  expect(call).toBeTruthy();
  return String(call?.[1] ?? '');
}

function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

describe('unifiedStorage save bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUnifiedStorageAutoSyncTrigger(null);
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 1024 });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/app/settings.json')) {
        return JSON.stringify({
          version: 2,
          lastModified: 1,
          data: {
            settings: {
              timezone: { offset: 480, city: 'Beijing' },
              markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
            },
            customIcons: [],
          },
        });
      }

      if (path.endsWith('/chat/sessions/index.json')) {
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
            deletedProviderIds: ['deleted-provider'],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });
  });

  it('bounds provider file cleanup directory scans', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/providers')) {
        return [
          ...Array.from({ length: MAX_AI_PROVIDER_FILE_SCAN_ENTRIES }, (_, index) => ({
            name: `skip-${index}.txt`,
            path: `/appdata/.vlaina/chat/providers/skip-${index}.txt`,
            isFile: true,
            isDirectory: false,
          })),
          {
            name: 'deleted-provider.json',
            path: '/appdata/.vlaina/chat/providers/deleted-provider.json',
            isFile: true,
            isDirectory: false,
          },
        ];
      }

      return [];
    });

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
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
        deletedProviderIds: ['deleted-provider'],
      },
    });

    expect(mocks.storage.deleteFile).not.toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/providers/deleted-provider.json',
    );
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('deleted-provider');
  });

  it('limits concurrent provider secret syncs during save', async () => {
    const providers = Array.from(
      { length: MAX_AI_PROVIDER_STORAGE_CONCURRENCY + 3 },
      (_value, index) => ({
        id: `provider-${index}`,
        name: `Provider ${index}`,
        type: 'newapi' as const,
        apiHost: 'https://provider.example',
        apiKey: `sk-${index}`,
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      })
    );
    let activeSecrets = 0;
    let maxActiveSecrets = 0;
    mocks.setProviderSecret.mockImplementation(async () => {
      activeSecrets += 1;
      maxActiveSecrets = Math.max(maxActiveSecrets, activeSecrets);
      await new Promise((resolve) => setTimeout(resolve, 0));
      activeSecrets -= 1;
    });
    mocks.storage.listDir.mockResolvedValue([]);

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
      ai: {
        providers,
        models: [],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: null,
        currentSessionId: null,
        deletedProviderIds: [],
      },
    });

    expect(mocks.setProviderSecret).toHaveBeenCalledTimes(providers.length);
    expect(maxActiveSecrets).toBeLessThanOrEqual(MAX_AI_PROVIDER_STORAGE_CONCURRENCY);
  });

  it('keeps saved main data within the loadable file size limit', async () => {
    mocks.storage.listDir.mockResolvedValue([]);
    const customIcons = Array.from({ length: 600 }, (_value, index) => ({
      id: `icon-${index}`,
      url: 'u'.repeat(MAX_CUSTOM_ICON_URL_CHARS),
      name: `icon-${index}.png`,
      createdAt: index + 1,
    }));

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons,
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
        deletedProviderIds: [],
      },
    });

    const mainPayload = getWritePayload('/.vlaina/app/settings.json');
    const parsed = JSON.parse(mainPayload);
    expect(getUtf8ByteLength(mainPayload)).toBeLessThanOrEqual(MAX_MAIN_DATA_BYTES);
    expect(parsed.data.customIcons.length).toBeLessThan(customIcons.length);
  });

  it('keeps saved AI session metadata within the loadable file size limit', async () => {
    mocks.storage.listDir.mockResolvedValue([]);
    const sessions = Array.from({ length: 600 }, (_value, index) => ({
      id: `session-${index}`,
      title: 't'.repeat(4096),
      modelId: '',
      createdAt: index + 1,
      updatedAt: index + 1,
    }));

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
      ai: {
        providers: [],
        models: [],
        benchmarkResults: {},
        fetchedModels: {},
        sessions,
        messages: {},
        unreadSessionIds: sessions.map((session) => session.id),
        selectedModelId: null,
        currentSessionId: null,
        deletedProviderIds: [],
      },
    });

    const sessionsPayload = getWritePayload('/chat/sessions/index.json');
    const parsed = JSON.parse(sessionsPayload);
    expect(getUtf8ByteLength(sessionsPayload)).toBeLessThanOrEqual(MAX_AI_SESSIONS_BYTES);
    expect(parsed.data.sessions.length).toBeLessThan(sessions.length);
  });

  it('keeps saved provider files within the loadable file size limit', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.listDir.mockResolvedValue([]);
    const models = Array.from({ length: 600 }, (_value, index) => ({
      id: `provider-1::model-${index}`,
      apiModelId: `model-${index}-${'m'.repeat(4096)}`,
      name: 'n'.repeat(4096),
      group: 'g'.repeat(4096),
      providerId: 'provider-1',
      enabled: true,
      createdAt: index + 1,
    }));

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
      ai: {
        providers: [{
          id: 'provider-1',
          name: 'Provider'.repeat(1000),
          type: 'newapi',
          apiHost: `https://provider.example/${'h'.repeat(4096)}`,
          apiKey: 'k'.repeat(5000),
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
        }],
        models,
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: null,
        currentSessionId: null,
        deletedProviderIds: [],
      },
    });

    const providerPayload = getWritePayload('/chat/providers/provider-1.json');
    const parsed = JSON.parse(providerPayload);
    expect(getUtf8ByteLength(providerPayload)).toBeLessThanOrEqual(MAX_AI_PROVIDER_FILE_BYTES);
    expect(parsed.data.provider.name).toHaveLength(4096);
    expect(parsed.data.provider.apiKey).toHaveLength(4096);
    expect(parsed.data.models.length).toBeLessThan(models.length);
  });
});
