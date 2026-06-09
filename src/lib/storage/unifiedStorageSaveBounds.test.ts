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
  MAX_AI_CHANNEL_CLEANUP_SCAN_ENTRIES,
  MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
  saveUnifiedDataImmediate,
  setUnifiedStorageAutoSyncTrigger,
} from './unifiedStorage';

describe('unifiedStorage save bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUnifiedStorageAutoSyncTrigger(null);
    mocks.hasElectronDesktopBridge.mockReturnValue(true);
    mocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
    mocks.storage.exists.mockResolvedValue(true);
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 1024 });
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
            deletedSessionIds: [],
            deletedProviderIds: ['deleted-provider', 'overflow-tts'],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });
  });

  it('bounds provider and legacy TTS channel cleanup directory scans', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path.endsWith('/chat/channels')) {
        return [
          ...Array.from({ length: MAX_AI_CHANNEL_CLEANUP_SCAN_ENTRIES }, (_, index) => ({
            name: `skip-${index}.txt`,
            path: `/appdata/.vlaina/chat/channels/skip-${index}.txt`,
            isFile: true,
            isDirectory: false,
          })),
          {
            name: 'deleted-provider.json',
            path: '/appdata/.vlaina/chat/channels/deleted-provider.json',
            isFile: true,
            isDirectory: false,
          },
        ];
      }

      if (path.endsWith('/chat/tts-channels')) {
        return [
          ...Array.from({ length: MAX_AI_CHANNEL_CLEANUP_SCAN_ENTRIES }, (_, index) => ({
            name: `skip-${index}.txt`,
            path: `/appdata/.vlaina/chat/tts-channels/skip-${index}.txt`,
            isFile: true,
            isDirectory: false,
          })),
          {
            name: 'overflow-tts.json',
            path: '/appdata/.vlaina/chat/tts-channels/overflow-tts.json',
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
      '/appdata/.vlaina/chat/channels/deleted-provider.json',
    );
    expect(mocks.storage.deleteFile).not.toHaveBeenCalledWith(
      '/appdata/.vlaina/chat/tts-channels/overflow-tts.json',
    );
    expect(mocks.deleteProviderSecret).not.toHaveBeenCalledWith('deleted-provider');
    expect(mocks.deleteProviderSecret).not.toHaveBeenCalledWith('overflow-tts');
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
});
