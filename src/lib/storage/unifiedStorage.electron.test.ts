import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedData } from './unifiedStorage';

const mocks = vi.hoisted(() => {
  const storage = {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
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

import { saveUnifiedDataImmediate } from './unifiedStorage';

describe('unifiedStorage electron save', () => {
  beforeEach(() => {
    mocks.storage.getBasePath.mockClear();
    mocks.storage.exists.mockClear();
    mocks.storage.mkdir.mockClear();
    mocks.storage.writeFile.mockClear();
    mocks.storage.listDir.mockReset();
    mocks.storage.deleteFile.mockClear();
    mocks.joinPath.mockReset();
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.setProviderSecret.mockClear();
    mocks.deleteProviderSecret.mockClear();

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

  it('syncs provider secrets and removes stale channel files in electron runtime', async () => {
    const data: UnifiedData = {
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { codeBlock: { showLineNumbers: true } },
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
      },
    };

    await saveUnifiedDataImmediate(data);

    expect(mocks.setProviderSecret).toHaveBeenCalledWith('active-provider', 'sk-live');
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('empty-provider');
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('stale-provider');
    expect(mocks.deleteProviderSecret).toHaveBeenCalledWith('legacy-tts');
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/channels/stale-provider.json');
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/appdata/.vlaina/chat/tts-channels/legacy-tts.json');

    const providerWrite = mocks.storage.writeFile.mock.calls.find(([path]) =>
      String(path).endsWith('/chat/channels/active-provider.json'),
    );
    expect(providerWrite).toBeTruthy();
    expect(String(providerWrite?.[1])).not.toContain('sk-live');
    expect(String(providerWrite?.[1])).toContain('"apiKey": ""');
  });

  it('skips keychain cleanup work outside electron runtime', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);

    const data: UnifiedData = {
      settings: {
        timezone: { offset: 480, city: 'Beijing' },
        markdown: { codeBlock: { showLineNumbers: true } },
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
});
