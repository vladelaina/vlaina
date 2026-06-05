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

import { loadUnifiedData } from './unifiedStorage';

describe('unifiedStorage load bounds', () => {
  beforeEach(() => {
    mocks.storage.getBasePath.mockClear();
    mocks.storage.exists.mockReset();
    mocks.storage.mkdir.mockClear();
    mocks.storage.readFile.mockReset();
    mocks.storage.stat.mockReset();
    mocks.storage.writeFile.mockClear();
    mocks.storage.listDir.mockReset();
    mocks.storage.deleteFile.mockClear();
    mocks.joinPath.mockReset();
    mocks.hasElectronDesktopBridge.mockReturnValue(false);

    mocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 1024 });
    mocks.storage.listDir.mockResolvedValue([]);
  });

  it('bounds provider channel lookups from persisted session metadata', async () => {
    const providerIds = [
      'provider-0',
      ...Array.from({ length: 205 }, (_, index) => `provider-${index}`),
      '../outside',
    ];
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/data.json') ||
      path.endsWith('/chat/sessions.json')
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
            providerIds,
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();
    const channelExistsPaths = mocks.storage.exists.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/chat/channels/'));

    expect(data.ai?.providers).toEqual([]);
    expect(new Set(channelExistsPaths)).toHaveLength(200);
    expect(channelExistsPaths).toContain('/appdata/.vlaina/chat/channels/provider-199.json');
    expect(channelExistsPaths).not.toContain('/appdata/.vlaina/chat/channels/provider-200.json');
    expect(channelExistsPaths).not.toContain('/appdata/.vlaina/chat/channels/../outside.json');
  });

  it('bounds models restored from a provider channel file', async () => {
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/data.json') ||
      path.endsWith('/chat/sessions.json') ||
      path.endsWith('/chat/channels/provider-1.json')
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
            providerIds: ['provider-1'],
          },
        });
      }

      if (path.endsWith('/chat/channels/provider-1.json')) {
        return JSON.stringify({
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
            models: Array.from({ length: 2105 }, (_, index) => ({
              apiModelId: `model-${index}`,
              providerId: 'provider-1',
              enabled: true,
              createdAt: 1,
            })),
            fetchedModels: Array.from({ length: 2105 }, (_, index) => `model-${index}`),
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.providers.map((provider) => provider.id)).toEqual(['provider-1']);
    expect(data.ai?.models).toHaveLength(2000);
    expect(data.ai?.models[0]?.id).toBe('provider-1::model-0');
    expect(data.ai?.models.at(-1)?.id).toBe('provider-1::model-1999');
    expect(data.ai?.fetchedModels?.['provider-1']).toHaveLength(2000);
    expect(data.ai?.fetchedModels?.['provider-1']?.at(-1)).toBe('model-1999');
  });
});
