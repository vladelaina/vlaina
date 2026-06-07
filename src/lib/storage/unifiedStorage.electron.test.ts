import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedData } from './unifiedStorage';

const mocks = vi.hoisted(() => {
  const storage = {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
    stat: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    listDir: vi.fn(),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  };

  return {
    storage,
    joinPath: vi.fn(),
    hasElectronDesktopBridge: vi.fn(() => true),
    setProviderSecret: vi.fn().mockResolvedValue(undefined),
    deleteProviderSecret: vi.fn().mockResolvedValue(undefined),
    addToast: vi.fn(),
  };
});

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  joinPath: mocks.joinPath,
}));

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: mocks.hasElectronDesktopBridge,
}));

vi.mock('@/lib/desktop/secretsCommands', () => ({
  aiProviderSecretCommands: {
    getProviderSecrets: vi.fn(),
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
  MAX_AI_PROVIDER_CHANNEL_FETCHED_MODELS,
  MAX_AI_PROVIDER_CHANNEL_MODELS,
  MAX_AI_PROVIDER_CHANNELS,
  MAX_AI_SESSION_RECORDS,
  registerUnifiedStorageAutoSyncTrigger,
  saveUnifiedDataImmediate,
  setUnifiedStorageAutoSyncTrigger,
} from './unifiedStorage';
import { loadUnifiedData } from './unifiedStorage';

describe('unifiedStorage electron save', () => {
  beforeEach(() => {
    mocks.storage.getBasePath.mockClear();
    mocks.storage.exists.mockReset();
    mocks.storage.mkdir.mockReset();
    mocks.storage.readFile.mockReset();
    mocks.storage.stat.mockReset();
    mocks.storage.writeFile.mockReset();
    mocks.storage.listDir.mockReset();
    mocks.storage.deleteFile.mockReset();
    mocks.joinPath.mockReset();
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.setProviderSecret.mockClear();
    mocks.deleteProviderSecret.mockClear();
    setUnifiedStorageAutoSyncTrigger(null);

    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.mkdir.mockResolvedValue(undefined);
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 1024 });
    mocks.storage.writeFile.mockResolvedValue(undefined);
    mocks.storage.deleteFile.mockResolvedValue(undefined);
    mocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/channels')) {
        return [
          { name: 'active-provider.json', path: '/appdata/.vlaina/chat/channels/active-provider.json', isFile: true, isDirectory: false },
          { name: 'stale-provider.json', path: '/appdata/.vlaina/chat/channels/stale-provider.json', isFile: true, isDirectory: false },
        ];
      }

      if (path.endsWith('/chat/tts-channels')) {
        return [
          { name: 'legacy-tts.json', path: '/appdata/.vlaina/chat/tts-channels/legacy-tts.json', isFile: true, isDirectory: false },
        ];
      }

      return [];
    });
  });

  it('keeps the newest unified auto-sync trigger when an older registration is disposed', async () => {
    const staleTrigger = vi.fn();
    const activeTrigger = vi.fn();
    const unregisterStale = registerUnifiedStorageAutoSyncTrigger(staleTrigger);
    const unregisterActive = registerUnifiedStorageAutoSyncTrigger(activeTrigger);

    unregisterStale();

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
    });

    expect(staleTrigger).not.toHaveBeenCalled();
    expect(activeTrigger).toHaveBeenCalledTimes(1);

    unregisterActive();
  });

  it('syncs provider secrets and removes stale channel files in electron runtime', async () => {
    const data: UnifiedData = {
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
      ai: {
        providers: [
          {
            id: 'active-provider',
            name: 'Active',
            type: 'newapi',
            apiHost: 'https://example.com',
            apiKey: 'sk-live',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: 'empty-provider',
            name: 'Empty',
            type: 'newapi',
            apiHost: 'https://example.com',
            apiKey: '',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          },
          {
            id: '../outside',
            name: 'Unsafe',
            type: 'newapi',
            apiHost: 'https://example.com',
            apiKey: 'sk-unsafe',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        models: [
          {
            id: 'active-provider:model-a',
            apiModelId: 'model-a',
            name: 'Model A',
            group: 'default',
            providerId: 'active-provider',
            enabled: true,
            createdAt: 1,
          },
        ],
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
        deletedProviderIds: ['stale-provider'],
      },
    };

    await saveUnifiedDataImmediate(data);

    expect(mocks.setProviderSecret).toHaveBeenCalledWith('active-provider', 'sk-live');
    expect(mocks.setProviderSecret).not.toHaveBeenCalledWith('../outside', 'sk-unsafe');
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('empty-provider');
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('stale-provider');
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('legacy-tts');
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/channels/stale-provider.json');
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/tts-channels/legacy-tts.json');

    const providerWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/channels/active-provider.json'),
    );
    expect(providerWrite).toBeTruthy();
    const providerPayload = JSON.parse(String(providerWrite?.[1]));
    expect(providerPayload).toMatchObject({
      version: 1,
      providerId: 'active-provider',
      data: {
        provider: {
          id: 'active-provider',
          apiKey: '',
        },
      },
    });
    expect(String(providerWrite?.[1])).not.toContain('sk-live');
    expect(mocks.storage.writeFile).not.toHaveBeenCalledWith(
      expect.stringContaining('../outside.json'),
      expect.anything(),
    );

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    expect(JSON.parse(String(sessionsWrite?.[1]))).toMatchObject({
      version: 1,
      data: {
        providerIds: ['active-provider', 'empty-provider'],
        deletedProviderIds: ['stale-provider'],
      },
    });
  });

  it('bounds AI metadata written during split saves', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.listDir.mockResolvedValue([]);
    const boundedProviderId = `provider-${MAX_AI_PROVIDER_CHANNELS - 1}`;

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
      ai: {
        providers: [
          ...Array.from({ length: MAX_AI_PROVIDER_CHANNELS + 2 }, (_, index) => ({
            id: `provider-${index}`,
            name: `Provider ${index}`,
            type: 'newapi' as const,
            apiHost: 'https://example.com',
            apiKey: '',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          })),
          {
            id: '../outside',
            name: 'Unsafe',
            type: 'newapi',
            apiHost: 'https://example.com',
            apiKey: '',
            enabled: true,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        models: [
          ...Array.from({ length: MAX_AI_PROVIDER_CHANNEL_MODELS + 10 }, (_, index) => ({
            id: `provider-0::model-${index}`,
            apiModelId: `model-${index}`,
            name: `Model ${index}`,
            group: 'default',
            providerId: 'provider-0',
            enabled: true,
            createdAt: 1,
          })),
          {
            id: '../outside::model',
            apiModelId: 'model',
            name: 'Unsafe Model',
            group: 'default',
            providerId: '../outside',
            enabled: true,
            createdAt: 1,
          },
        ],
        benchmarkResults: {},
        fetchedModels: {
          'provider-0': Array.from({ length: MAX_AI_PROVIDER_CHANNEL_FETCHED_MODELS + 10 }, (_, index) => (
            index === 1 ? 'model-0' : `fetched-${index}`
          )),
        },
        sessions: [
          ...Array.from({ length: MAX_AI_SESSION_RECORDS + 10 }, (_, index) => ({
            id: `session-${index}`,
            title: `Session ${index}`,
            modelId: 'provider-0::model-0',
            createdAt: index,
            updatedAt: index,
          })),
          { id: '../outside', title: 'Unsafe session', modelId: '', createdAt: 1, updatedAt: 1 },
          { id: 'temp-session-local', title: 'Temporary session', modelId: '', createdAt: 1, updatedAt: 1 },
        ],
        messages: {},
        unreadSessionIds: ['session-0', '../outside', `session-${MAX_AI_SESSION_RECORDS + 1}`],
        selectedModelId: 'provider-0::model-0',
        currentSessionId: 'session-0',
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
      },
    });

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    const sessionsPayload = JSON.parse(String(sessionsWrite?.[1]));
    expect(sessionsPayload.data.providerIds).toHaveLength(MAX_AI_PROVIDER_CHANNELS);
    expect(sessionsPayload.data.providerIds.at(-1)).toBe(boundedProviderId);
    expect(sessionsPayload.data.providerIds).not.toContain(`provider-${MAX_AI_PROVIDER_CHANNELS}`);
    expect(sessionsPayload.data.providerIds).not.toContain('../outside');
    expect(sessionsPayload.data.sessions).toHaveLength(MAX_AI_SESSION_RECORDS);
    expect(sessionsPayload.data.sessions[0].id).toBe(`session-${MAX_AI_SESSION_RECORDS - 1}`);
    expect(sessionsPayload.data.sessions.at(-1).id).toBe('session-0');
    expect(sessionsPayload.data.sessions.map((session: { id: string }) => session.id)).not.toContain('../outside');
    expect(sessionsPayload.data.sessions.map((session: { id: string }) => session.id)).not.toContain('temp-session-local');
    expect(sessionsPayload.data.unreadSessionIds).toEqual(['session-0']);
    expect(sessionsPayload.data.currentSessionId).toBe('session-0');
    expect(sessionsPayload.data.selectedModelId).toBe('provider-0::model-0');

    const providerWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/channels/provider-0.json'),
    );
    const providerPayload = JSON.parse(String(providerWrite?.[1]));
    expect(providerPayload.data.models).toHaveLength(MAX_AI_PROVIDER_CHANNEL_MODELS);
    expect(providerPayload.data.models.at(-1).apiModelId).toBe(`model-${MAX_AI_PROVIDER_CHANNEL_MODELS - 1}`);
    expect(providerPayload.data.fetchedModels).toHaveLength(MAX_AI_PROVIDER_CHANNEL_FETCHED_MODELS);
    expect(providerPayload.data.fetchedModels.at(-1)).toBe(`fetched-${MAX_AI_PROVIDER_CHANNEL_FETCHED_MODELS - 1}`);
    expect(mocks.storage.writeFile).not.toHaveBeenCalledWith(
      expect.stringContaining('../outside.json'),
      expect.anything(),
    );
    expect(mocks.storage.writeFile).not.toHaveBeenCalledWith(
      expect.stringContaining(`/chat/channels/provider-${MAX_AI_PROVIDER_CHANNELS}.json`),
      expect.anything(),
    );
  });

  it('preserves provider channels added by another window during a stale save', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
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
            providerIds: ['other-provider'],
            deletedSessionIds: [],
            deletedProviderIds: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/channels')) {
        return [
          { name: 'other-provider.json', path: '/appdata/.vlaina/chat/channels/other-provider.json', isFile: true, isDirectory: false },
        ];
      }
      return [];
    });

    const data: UnifiedData = {
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
      },
    };

    await saveUnifiedDataImmediate(data);

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    const payload = JSON.parse(String(sessionsWrite?.[1]));
    expect(payload.data.providerIds).toEqual(['other-provider']);
    expect(mocks.storage.deleteFile).not.toHaveBeenCalledWith('/appdata/.vlaina/chat/channels/other-provider.json');
  });

  it('does not resurrect provider channels deleted by another window during a stale save', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          version: 1,
          updatedAt: 2,
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
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/channels')) {
        return [
          { name: 'deleted-provider.json', path: '/appdata/.vlaina/chat/channels/deleted-provider.json', isFile: true, isDirectory: false },
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
        providers: [{
          id: 'deleted-provider',
          name: 'Deleted in another window',
          type: 'newapi',
          apiHost: 'https://example.com',
          apiKey: '',
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
        }],
        models: [{
          id: 'deleted-provider:model-a',
          apiModelId: 'model-a',
          name: 'Model A',
          group: 'default',
          providerId: 'deleted-provider',
          enabled: true,
          createdAt: 1,
        }],
        benchmarkResults: {
          'deleted-provider': {
            items: {},
            overall: 'success',
            updatedAt: 1,
          },
        },
        fetchedModels: {
          'deleted-provider': ['model-a'],
        },
        sessions: [],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: 'deleted-provider:model-a',
        currentSessionId: null,
      },
    });

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    const payload = JSON.parse(String(sessionsWrite?.[1]));
    expect(payload.data.providerIds).toEqual([]);
    expect(payload.data.deletedProviderIds).toEqual(['deleted-provider']);
    expect(payload.data.selectedModelId).toBeNull();
    expect(mocks.storage.writeFile).not.toHaveBeenCalledWith(
      expect.stringContaining('/chat/channels/deleted-provider.json'),
      expect.anything(),
    );
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/channels/deleted-provider.json');
  });

  it('preserves independent provider, settings, and icon edits from two stale windows', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    const disk = new Map<string, string>();
    const directoryPaths = new Set([
      '/appdata/.vlaina',
      '/appdata/.vlaina/chat',
      '/appdata/.vlaina/chat/channels',
      '/appdata/.vlaina/chat/sessions',
      '/appdata/.vlaina/chat/tts-channels',
    ]);
    mocks.storage.exists.mockImplementation(async (path: string) =>
      disk.has(path) || directoryPaths.has(path)
    );
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      const value = disk.get(path);
      if (value === undefined) {
        throw new Error(`Missing file: ${path}`);
      }
      return value;
    });
    mocks.storage.writeFile.mockImplementation(async (path: string, content: string) => {
      disk.set(path, content);
    });
    mocks.storage.deleteFile.mockImplementation(async (path: string) => {
      disk.delete(path);
    });
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      const prefix = `${path}/`;
      return Array.from(disk.keys())
        .filter((filePath) => filePath.startsWith(prefix))
        .map((filePath) => ({
          name: filePath.slice(prefix.length),
          path: filePath,
          isFile: true,
          isDirectory: false,
        }));
    });

    const windowAData: UnifiedData = {
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: false } },
        ui: { lastAppViewMode: 'notes' },
      },
      customIcons: [
        { id: '/app/.vlaina/assets/icons/a.png', url: 'img:/app/.vlaina/assets/icons/a.png', name: 'a.png', createdAt: 10 },
      ],
      deletedCustomIconIds: [],
      ai: {
        providers: [{
          id: 'provider-a',
          name: 'Provider A',
          type: 'newapi',
          apiHost: 'https://a.example.com',
          apiKey: '',
          enabled: true,
          createdAt: 1,
          updatedAt: 1,
        }],
        models: [{
          id: 'provider-a:model-a',
          apiModelId: 'model-a',
          name: 'Model A',
          group: 'default',
          providerId: 'provider-a',
          enabled: true,
          createdAt: 1,
        }],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: 'provider-a:model-a',
        currentSessionId: null,
      },
    };

    const windowBStaleData: UnifiedData = {
      settings: {
        timezone: { offset: 0, city: 'UTC' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
        ui: { lastAppViewMode: 'chat' },
      },
      customIcons: [
        { id: '/app/.vlaina/assets/icons/b.png', url: 'img:/app/.vlaina/assets/icons/b.png', name: 'b.png', createdAt: 20 },
      ],
      deletedCustomIconIds: [],
      ai: {
        providers: [{
          id: 'provider-b',
          name: 'Provider B',
          type: 'newapi',
          apiHost: 'https://b.example.com',
          apiKey: '',
          enabled: true,
          createdAt: 2,
          updatedAt: 2,
        }],
        models: [{
          id: 'provider-b:model-b',
          apiModelId: 'model-b',
          name: 'Model B',
          group: 'default',
          providerId: 'provider-b',
          enabled: true,
          createdAt: 2,
        }],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: 'provider-b:model-b',
        currentSessionId: null,
      },
    };

    await saveUnifiedDataImmediate(windowAData, {
      settings: {
        timezone: windowAData.settings.timezone,
      },
    });
    await saveUnifiedDataImmediate(windowBStaleData, {
      settings: {
        markdown: {
          codeBlock: { showLineNumbers: true },
        },
        ui: { lastAppViewMode: 'chat' },
      },
    });

    const mainPayload = JSON.parse(disk.get('/appdata/.vlaina/data.json') || '{}');
    expect(mainPayload.data.settings).toEqual({
      timezone: { offset: 480, city: 'Beijing' },
      markdown: {
        typewriterMode: false,
        theme: {
          importedThemeId: null,
        },
        body: { showLineNumbers: false },
        codeBlock: { showLineNumbers: true },
      },
      ui: {
        lastAppViewMode: 'chat',
        colorMode: 'system',
        themeId: 'default',
      },
    });
    expect(mainPayload.data.customIcons.map((icon: { id: string }) => icon.id)).toEqual([
      '/app/.vlaina/assets/icons/b.png',
      '/app/.vlaina/assets/icons/a.png',
    ]);

    const sessionsPayload = JSON.parse(disk.get('/appdata/.vlaina/chat/sessions.json') || '{}');
    expect(new Set(sessionsPayload.data.providerIds)).toEqual(new Set(['provider-a', 'provider-b']));
    expect(sessionsPayload.data.selectedModelId).toBe('provider-b:model-b');
    expect(disk.has('/appdata/.vlaina/chat/channels/provider-a.json')).toBe(true);
    expect(disk.has('/appdata/.vlaina/chat/channels/provider-b.json')).toBe(true);
  });

  it('preserves custom icons added by another window during a stale main-data save', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return JSON.stringify({
          version: 2,
          lastModified: 1,
          data: {
            settings: {
              timezone: { offset: 480, city: 'Beijing' },
              markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
            },
            customIcons: [
              { id: '/app/.vlaina/assets/icons/other.png', url: 'img:/app/.vlaina/assets/icons/other.png', name: 'other.png', createdAt: 20 },
            ],
            deletedCustomIconIds: [],
          },
        });
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

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [
        { id: '/app/.vlaina/assets/icons/local.png', url: 'img:/app/.vlaina/assets/icons/local.png', name: 'local.png', createdAt: 10 },
      ],
      deletedCustomIconIds: [],
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
      },
    });

    const mainWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/.vlaina/data.json'),
    );
    const payload = JSON.parse(String(mainWrite?.[1]));
    expect(payload.data.customIcons.map((icon: { id: string }) => icon.id)).toEqual([
      '/app/.vlaina/assets/icons/other.png',
      '/app/.vlaina/assets/icons/local.png',
    ]);
  });

  it('does not resurrect custom icons deleted by another window during a stale main-data save', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return JSON.stringify({
          version: 2,
          lastModified: 1,
          data: {
            settings: {
              timezone: { offset: 480, city: 'Beijing' },
              markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
            },
            customIcons: [],
            deletedCustomIconIds: ['/app/.vlaina/assets/icons/deleted.png'],
          },
        });
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

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [
        { id: '/app/.vlaina/assets/icons/deleted.png', url: 'img:/app/.vlaina/assets/icons/deleted.png', name: 'deleted.png', createdAt: 10 },
      ],
      deletedCustomIconIds: [],
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
      },
    });

    const mainWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/.vlaina/data.json'),
    );
    const payload = JSON.parse(String(mainWrite?.[1]));
    expect(payload.data.customIcons).toEqual([]);
    expect(payload.data.deletedCustomIconIds).toEqual(['/app/.vlaina/assets/icons/deleted.png']);
  });

  it('does not read existing main data during save when stat has no size', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/data.json')
        ? { isFile: true, isDirectory: false }
        : { isFile: true, isDirectory: false, size: 1024 }
    ));
    mocks.storage.readFile.mockImplementation(async (path: string) => {
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

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [
        { id: '/app/.vlaina/assets/icons/local.png', url: 'img:/app/.vlaina/assets/icons/local.png', name: 'local.png', createdAt: 10 },
      ],
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
      },
    });

    expect(mocks.storage.readFile).not.toHaveBeenCalledWith('/appdata/.vlaina/data.json');
    const mainWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/.vlaina/data.json'),
    );
    const payload = JSON.parse(String(mainWrite?.[1]));
    expect(payload.data.customIcons.map((icon: { id: string }) => icon.id)).toEqual([
      '/app/.vlaina/assets/icons/local.png',
    ]);
  });

  it('applies settings patches without overwriting unrelated settings from another window', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return JSON.stringify({
          version: 2,
          lastModified: 1,
          data: {
            settings: {
              timezone: { offset: -300, city: 'New York' },
              markdown: { typewriterMode: false, codeBlock: { showLineNumbers: false } },
              ui: { lastAppViewMode: 'chat' },
            },
            customIcons: [],
            deletedCustomIconIds: [],
          },
        });
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

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: true, codeBlock: { showLineNumbers: true } },
        ui: { lastAppViewMode: 'notes' },
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
      },
    }, {
      settings: {
        markdown: {
          codeBlock: {
            showLineNumbers: true,
          },
        },
      },
    });

    const mainWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/.vlaina/data.json'),
    );
    const payload = JSON.parse(String(mainWrite?.[1]));
    expect(payload.data.settings).toEqual({
      timezone: { offset: -300, city: 'New York' },
      markdown: {
        typewriterMode: false,
        theme: {
          importedThemeId: null,
        },
        body: { showLineNumbers: false },
        codeBlock: { showLineNumbers: true },
      },
      ui: {
        lastAppViewMode: 'chat',
        colorMode: 'system',
        themeId: 'default',
      },
    });
  });

  it('preserves disk settings when a stale save only changes non-settings data', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return JSON.stringify({
          version: 2,
          lastModified: 1,
          data: {
            settings: {
              timezone: { offset: -300, city: 'New York' },
              markdown: { typewriterMode: true, codeBlock: { showLineNumbers: true } },
              ui: { lastAppViewMode: 'chat' },
            },
            customIcons: [],
            deletedCustomIconIds: [],
          },
        });
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

    await saveUnifiedDataImmediate({
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: false } },
        ui: { lastAppViewMode: 'notes' },
      },
      customIcons: [
        { id: '/app/.vlaina/assets/icons/local.png', url: 'img:/app/.vlaina/assets/icons/local.png', name: 'local.png', createdAt: 10 },
      ],
      deletedCustomIconIds: [],
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
      },
    });

    const mainWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/.vlaina/data.json'),
    );
    const payload = JSON.parse(String(mainWrite?.[1]));
    expect(payload.data.settings).toEqual({
      timezone: { offset: -300, city: 'New York' },
      markdown: {
        typewriterMode: true,
        theme: {
          importedThemeId: null,
        },
        body: { showLineNumbers: false },
        codeBlock: { showLineNumbers: true },
      },
      ui: {
        lastAppViewMode: 'chat',
        colorMode: 'system',
        themeId: 'default',
      },
    });
    expect(payload.data.customIcons.map((icon: { id: string }) => icon.id)).toEqual([
      '/app/.vlaina/assets/icons/local.png',
    ]);
  });

  it('skips keychain cleanup work outside electron runtime', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);

    const data: UnifiedData = {
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
      },
    };

    await saveUnifiedDataImmediate(data);

    expect(mocks.setProviderSecret).not.toHaveBeenCalled();
    expect(mocks.deleteProviderSecret).not.toHaveBeenCalled();
  });

  it('preserves existing disk sessions that a stale window does not know about', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          version: 1,
          updatedAt: 1,
          data: {
            sessions: [
              { id: 'session-2', title: 'From other window', modelId: '', createdAt: 2, updatedAt: 20 },
            ],
            selectedModelId: null,
            unreadSessionIds: [],
            currentSessionId: null,
            temporaryChatEnabled: false,
            customSystemPrompt: '',
            includeTimeContext: true,
            webSearchEnabled: false,
            providerIds: [],
            deletedSessionIds: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data: UnifiedData = {
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
        sessions: [
          { id: 'session-1', title: 'Local window', modelId: '', createdAt: 1, updatedAt: 10 },
        ],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: null,
        currentSessionId: 'session-1',
      },
    };

    await saveUnifiedDataImmediate(data);

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    const payload = JSON.parse(String(sessionsWrite?.[1]));
    expect(payload.data.sessions.map((session: { id: string }) => session.id)).toEqual([
      'session-2',
      'session-1',
    ]);
  });

  it('does not resurrect a disk-deleted session from stale window state', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.exists.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions/session-2.json')) {
        return false;
      }
      return true;
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          version: 1,
          updatedAt: 1,
          data: {
            sessions: [
              { id: 'session-2', title: 'Deleted elsewhere', modelId: '', createdAt: 2, updatedAt: 20 },
            ],
            selectedModelId: null,
            unreadSessionIds: [],
            currentSessionId: null,
            temporaryChatEnabled: false,
            customSystemPrompt: '',
            includeTimeContext: true,
            webSearchEnabled: false,
            providerIds: [],
            deletedSessionIds: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data: UnifiedData = {
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
        sessions: [
          { id: 'session-1', title: 'Local window', modelId: '', createdAt: 1, updatedAt: 10 },
          { id: 'session-2', title: 'Stale deleted copy', modelId: '', createdAt: 2, updatedAt: 20 },
        ],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: null,
        currentSessionId: 'session-2',
      },
    };

    await saveUnifiedDataImmediate(data);

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    const payload = JSON.parse(String(sessionsWrite?.[1]));
    expect(payload.data.sessions.map((session: { id: string }) => session.id)).toEqual(['session-1']);
    expect(payload.data.currentSessionId).toBeNull();
    expect(payload.data.deletedSessionIds).toEqual(['session-2']);
  });

  it('drops temporary sessions when merging existing disk metadata', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          version: 1,
          updatedAt: 1,
          data: {
            sessions: [
              { id: 'temp-session-legacy', title: 'Temporary Chat', modelId: '', createdAt: 1, updatedAt: 30 },
              { id: 'session-2', title: 'From other window', modelId: '', createdAt: 2, updatedAt: 20 },
            ],
            selectedModelId: null,
            unreadSessionIds: ['temp-session-legacy', 'session-2'],
            currentSessionId: 'temp-session-legacy',
            temporaryChatEnabled: true,
            customSystemPrompt: '',
            includeTimeContext: true,
            webSearchEnabled: false,
            providerIds: [],
            deletedSessionIds: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data: UnifiedData = {
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
        sessions: [
          { id: 'session-1', title: 'Local window', modelId: '', createdAt: 1, updatedAt: 10 },
        ],
        messages: {},
        unreadSessionIds: [],
        selectedModelId: null,
        currentSessionId: 'session-1',
      },
    };

    await saveUnifiedDataImmediate(data);

    const sessionsWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/sessions.json'),
    );
    const payload = JSON.parse(String(sessionsWrite?.[1]));
    expect(payload.data.sessions.map((session: { id: string }) => session.id)).toEqual([
      'session-2',
      'session-1',
    ]);
    expect(payload.data.unreadSessionIds).toEqual([]);
    expect(payload.data.currentSessionId).toBe('session-1');
    expect(payload.data.temporaryChatEnabled).toBe(false);
  });

  it('trusts provider channel filenames over mismatched provider ids when loading split storage', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
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

      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          version: 1,
          updatedAt: 1,
          data: {
            sessions: [],
            providerIds: ['good-provider', 'evil-provider'],
          },
        });
      }

      if (path.endsWith('/chat/channels/good-provider.json')) {
        return JSON.stringify({
          version: 1,
          providerId: 'good-provider',
          updatedAt: 1,
          data: {
            provider: {
              id: 'good-provider',
              name: 'Good',
              type: 'newapi',
              apiHost: 'https://good.example',
              apiKey: '',
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
            models: [
              {
                apiModelId: 'model-a',
                providerId: 'good-provider',
                enabled: true,
                createdAt: 1,
              },
            ],
            benchmarkResults: { items: {} },
            fetchedModels: ['model-a', 123],
          },
        });
      }

      if (path.endsWith('/chat/channels/evil-provider.json')) {
        return JSON.stringify({
          version: 1,
          providerId: 'evil-provider',
          updatedAt: 1,
          data: {
            provider: {
              id: '__proto__',
              name: 'Evil',
              type: 'newapi',
              apiHost: 'https://evil.example',
              apiKey: '',
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
            models: [
              {
                apiModelId: 'model-b',
                providerId: '__proto__',
                enabled: true,
                createdAt: 1,
              },
            ],
            benchmarkResults: { polluted: true },
            fetchedModels: ['model-b'],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.providers.map((provider) => provider.id)).toEqual(['good-provider']);
    expect(data.ai?.models.map((model) => model.providerId)).toEqual(['good-provider']);
    expect(data.ai?.benchmarkResults?.['good-provider']).toEqual({
      items: {},
      overall: 'idle',
      updatedAt: expect.any(Number),
    });
    expect(data.ai?.fetchedModels).toEqual({ 'good-provider': ['model-a'] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('does not read AI sessions metadata when stat has no size', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path.endsWith('/chat/sessions.json')
        ? { isFile: true, isDirectory: false }
        : { isFile: true, isDirectory: false, size: 1024 }
    ));
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
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

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.sessions).toEqual([]);
    expect(mocks.storage.readFile).not.toHaveBeenCalledWith('/appdata/.vlaina/chat/sessions.json');
  });

  it('does not read provider channel files when stat has no size', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path.endsWith('/chat/channels/good-provider.json')
        ? { isFile: true, isDirectory: false }
        : { isFile: true, isDirectory: false, size: 1024 }
    ));
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
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
            providerIds: ['good-provider'],
            deletedSessionIds: [],
            deletedProviderIds: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.providers).toEqual([]);
    expect(mocks.storage.readFile).not.toHaveBeenCalledWith('/appdata/.vlaina/chat/channels/good-provider.json');
  });

  it('recovers visible sessions from message files when AI session metadata is invalid', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const messageContent = '![outer [nested]](<attachment://safe.png> "Title") ![video](https://example.com/movie.mp4) Please keep this important chat';
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions')) {
        return [
          { name: 'session-1.json', path: '/appdata/.vlaina/chat/sessions/session-1.json', isFile: true, isDirectory: false },
        ];
      }
      return [];
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
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

      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          sessions: [{ id: 'session-1', title: 'Legacy', modelId: '', createdAt: 1, updatedAt: 1 }],
          providerIds: ['legacy-provider'],
        });
      }

      if (path.endsWith('/chat/sessions/session-1.json')) {
        return JSON.stringify({
          version: 1,
          sessionId: 'session-1',
          updatedAt: 2,
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: messageContent,
              modelId: 'provider::model-a',
              timestamp: 10,
              versions: [{
                content: messageContent,
                createdAt: 10,
                subsequentMessages: [],
              }],
              currentVersionIndex: 0,
            },
          ],
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.sessions).toEqual([
      {
        id: 'session-1',
        title: '![video](https://example.com/movie.mp4) Please keep this imp...',
        modelId: 'provider::model-a',
        isPinned: false,
        createdAt: 10,
        updatedAt: 10,
      },
    ]);
    expect(data.ai?.messages).toEqual({});
    expect(data.ai?.providers).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Storage] Ignoring invalid AI sessions file:',
      '/appdata/.vlaina/chat/sessions.json',
    );
    warnSpy.mockRestore();
  });

  it('does not recover temporary session message files', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions')) {
        return [
          { name: 'temp-session-legacy.json', path: '/appdata/.vlaina/chat/sessions/temp-session-legacy.json', isFile: true, isDirectory: false },
          { name: 'session-1.json', path: '/appdata/.vlaina/chat/sessions/session-1.json', isFile: true, isDirectory: false },
        ];
      }
      return [];
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
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

      if (path.endsWith('/chat/sessions.json')) {
        return JSON.stringify({
          sessions: [],
          providerIds: [],
        });
      }

      if (path.endsWith('/chat/sessions/temp-session-legacy.json')) {
        throw new Error('Temporary sessions must not be loaded');
      }

      if (path.endsWith('/chat/sessions/session-1.json')) {
        return JSON.stringify({
          version: 1,
          sessionId: 'session-1',
          updatedAt: 2,
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'Recover only this chat',
              modelId: 'provider::model-a',
              timestamp: 10,
              versions: [{
                content: 'Recover only this chat',
                createdAt: 10,
                kind: 'original',
                subsequentMessages: [],
              }],
              currentVersionIndex: 0,
            },
          ],
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.sessions.map((session) => session.id)).toEqual(['session-1']);
    warnSpy.mockRestore();
  });

  it('does not recover deleted session message files from tombstoned metadata', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/sessions')) {
        return [
          { name: 'session-1.json', path: '/appdata/.vlaina/chat/sessions/session-1.json', isFile: true, isDirectory: false },
          { name: 'session-2.json', path: '/appdata/.vlaina/chat/sessions/session-2.json', isFile: true, isDirectory: false },
        ];
      }
      return [];
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
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
            deletedSessionIds: ['session-2'],
            deletedProviderIds: [],
          },
        });
      }

      if (path.endsWith('/chat/sessions/session-1.json')) {
        return JSON.stringify({
          version: 1,
          sessionId: 'session-1',
          updatedAt: 2,
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'Recover this chat',
              modelId: 'provider::model-a',
              timestamp: 10,
              versions: [{
                content: 'Recover this chat',
                createdAt: 10,
                kind: 'original',
                subsequentMessages: [],
              }],
              currentVersionIndex: 0,
            },
          ],
        });
      }

      if (path.endsWith('/chat/sessions/session-2.json')) {
        return JSON.stringify({
          version: 1,
          sessionId: 'session-2',
          updatedAt: 3,
          messages: [
            {
              id: 'm2',
              role: 'user',
              content: 'Deleted chat must stay deleted',
              modelId: 'provider::model-a',
              timestamp: 20,
              versions: [{
                content: 'Deleted chat must stay deleted',
                createdAt: 20,
                kind: 'original',
                subsequentMessages: [],
              }],
              currentVersionIndex: 0,
            },
          ],
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.sessions.map((session) => session.id)).toEqual(['session-1']);
    expect(data.ai?.deletedSessionIds).toEqual(['session-2']);
  });
});
