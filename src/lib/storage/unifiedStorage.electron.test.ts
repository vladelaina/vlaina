import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnifiedData } from './unifiedStorage';

const mocks = vi.hoisted(() => {
  const storage = {
    getBasePath: vi.fn().mockResolvedValue('/appdata'),
    exists: vi.fn().mockResolvedValue(true),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn(),
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
import { loadUnifiedData } from './unifiedStorage';

describe('unifiedStorage electron save', () => {
  beforeEach(() => {
    mocks.storage.getBasePath.mockClear();
    mocks.storage.exists.mockClear();
    mocks.storage.mkdir.mockClear();
    mocks.storage.readFile.mockReset();
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
    expect(data.ai?.benchmarkResults).toEqual({ 'good-provider': { items: {} } });
    expect(data.ai?.fetchedModels).toEqual({ 'good-provider': ['model-a'] });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('recovers visible sessions from message files when AI session metadata is invalid', async () => {
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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
              content: 'Please keep this important chat',
              modelId: 'provider::model-a',
              timestamp: 10,
              versions: [{
                content: 'Please keep this important chat',
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
        title: 'Please keep this important chat',
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
});
