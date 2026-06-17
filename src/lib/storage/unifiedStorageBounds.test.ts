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

import {
  MAX_AI_PROVIDER_FILE_SCAN_ENTRIES,
  MAX_CUSTOM_ICON_ID_CHARS,
  MAX_CUSTOM_ICON_NAME_CHARS,
  MAX_CUSTOM_ICON_URL_CHARS,
  MAX_CUSTOM_ICONS,
  MAX_DELETED_CUSTOM_ICON_IDS,
  MAX_SETTINGS_TIMEZONE_CITY_CHARS,
  MAX_SETTINGS_UI_THEME_ID_CHARS,
  MAX_AI_PROVIDER_FETCHED_MODELS,
  MAX_AI_PROVIDER_STORAGE_CONCURRENCY,
  MAX_ORPHAN_CHAT_SESSION_DIR_SCAN_ENTRIES,
  loadUnifiedData,
} from './unifiedStorage';
import { MAX_LOADED_AI_FIELD_CHARS } from './unifiedStorageAI';

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

  it('bounds provider file lookups from persisted session metadata', async () => {
    const providerIds = [
      'provider-0',
      ...Array.from({ length: 205 }, (_, index) => `provider-${index}`),
      '../outside',
    ];
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith('/chat/sessions/index.json')
    ));
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
            providerIds,
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();
    const providerExistsPaths = mocks.storage.exists.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.includes('/chat/providers/'));

    expect(data.ai?.providers).toEqual([]);
    expect(new Set(providerExistsPaths)).toHaveLength(200);
    expect(providerExistsPaths).toContain('/appdata/.vlaina/chat/providers/provider-199.json');
    expect(providerExistsPaths).not.toContain('/appdata/.vlaina/chat/providers/provider-200.json');
    expect(providerExistsPaths).not.toContain('/appdata/.vlaina/chat/providers/../outside.json');
  });

  it('limits concurrent provider file reads during load', async () => {
    const providerIds = Array.from(
      { length: MAX_AI_PROVIDER_STORAGE_CONCURRENCY + 3 },
      (_value, index) => `provider-${index}`
    );
    let activeReads = 0;
    let maxActiveReads = 0;
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith('/chat/sessions/index.json') ||
      path.includes('/chat/providers/')
    ));
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
            providerIds,
          },
        });
      }

      if (path.includes('/chat/providers/')) {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 0));
        activeReads -= 1;
        const providerId = path.split('/').pop()?.replace(/\.json$/, '') || '';
        return JSON.stringify({
          version: 1,
          providerId,
          updatedAt: 1,
          data: {
            provider: {
              id: providerId,
              name: providerId,
              type: 'newapi',
              apiHost: 'https://provider.example',
              apiKey: '',
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
            models: [],
            fetchedModels: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.providers).toHaveLength(providerIds.length);
    expect(maxActiveReads).toBeLessThanOrEqual(MAX_AI_PROVIDER_STORAGE_CONCURRENCY);
  });

  it('bounds models restored from a provider file file', async () => {
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith('/chat/sessions/index.json') ||
      path.endsWith('/chat/providers/provider-1.json')
    ));
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
            providerIds: ['provider-1'],
          },
        });
      }

      if (path.endsWith('/chat/providers/provider-1.json')) {
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

  it('bounds split AI session and provider file string fields on load', async () => {
    const longModelId = `${'m'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`;
    const longPrompt = `${'p'.repeat(64 * 1024)}x`;
    const longFetchedModel = `${'f'.repeat(MAX_LOADED_AI_FIELD_CHARS)}x`;

    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith('/chat/sessions/index.json') ||
      path.endsWith('/chat/providers/provider-1.json')
    ));
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
            sessions: [{
              id: 'session-1',
              title: 'Session',
              modelId: longModelId,
            }],
            selectedModelId: longModelId,
            currentSessionId: '../unsafe',
            customSystemPrompt: longPrompt,
            providerIds: ['provider-1'],
          },
        });
      }

      if (path.endsWith('/chat/providers/provider-1.json')) {
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
            models: [{
              apiModelId: longModelId,
              providerId: 'provider-1',
              enabled: true,
              createdAt: 1,
            }],
            fetchedModels: [
              longFetchedModel,
              '',
              ...Array.from(
                { length: MAX_AI_PROVIDER_FETCHED_MODELS + 1 },
                (_, index) => `model-${index}`,
              ),
            ],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.selectedModelId).toBeNull();
    expect(data.ai?.currentSessionId).toBeNull();
    expect(data.ai?.customSystemPrompt).toHaveLength(64 * 1024);
    expect(data.ai?.models[0]?.apiModelId).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
    expect(data.ai?.sessions[0]?.modelId).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
    expect(data.ai?.fetchedModels?.['provider-1']).toHaveLength(MAX_AI_PROVIDER_FETCHED_MODELS);
    expect(data.ai?.fetchedModels?.['provider-1']?.[0]).toHaveLength(MAX_LOADED_AI_FIELD_CHARS);
  });

  it('ignores main data content that exceeds the limit after read', async () => {
    mocks.storage.exists.mockImplementation(async (path: string) => path.endsWith('/.vlaina/app/settings.json'));
    mocks.storage.readFile.mockResolvedValue('x'.repeat(2 * 1024 * 1024 + 1));

    const data = await loadUnifiedData();

    expect(data.settings.timezone.city).toBe('Beijing');
    expect(data.ai?.providers).toEqual([]);
  });

  it('ignores main data with invalid known stat size before reading', async () => {
    mocks.storage.exists.mockImplementation(async (path: string) => path.endsWith('/.vlaina/app/settings.json'));
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: -1 });
    mocks.storage.readFile.mockRejectedValue(new Error('Invalid stat size should not be read'));

    const data = await loadUnifiedData();

    expect(data.settings.timezone.city).toBe('Beijing');
    expect(data.ai?.providers).toEqual([]);
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('bounds settings string fields loaded from main data', async () => {
    const longCity = `${'c'.repeat(MAX_SETTINGS_TIMEZONE_CITY_CHARS)}x`;
    const longThemeId = `${'t'.repeat(MAX_SETTINGS_UI_THEME_ID_CHARS)}x`;
    mocks.storage.exists.mockImplementation(async (path: string) => path.endsWith('/.vlaina/app/settings.json'));
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/app/settings.json')) {
        return JSON.stringify({
          version: 2,
          lastModified: 1,
          data: {
            settings: {
              timezone: { offset: 480, city: longCity },
              markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
              ui: {
                themeId: longThemeId,
                notesChatFloatingSize: { width: 9999, height: 1 },
              },
            },
            customIcons: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.settings.timezone.city).toHaveLength(MAX_SETTINGS_TIMEZONE_CITY_CHARS);
    expect(data.settings.ui?.themeId).toHaveLength(MAX_SETTINGS_UI_THEME_ID_CHARS);
    expect(data.settings.ui?.notesChatFloatingSize).toEqual({ width: 760, height: 420 });
  });

  it('bounds custom icon metadata loaded from main data', async () => {
    mocks.storage.exists.mockImplementation(async (path: string) => path.endsWith('/.vlaina/app/settings.json'));
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
            customIcons: [
              {
                id: 'icon-0',
                url: 'img:/app/.vlaina/app/assets/icons/icon-0.png',
                name: 'icon-0.png',
                createdAt: 1,
              },
              {
                id: 'icon-0',
                url: 'img:/app/.vlaina/app/assets/icons/duplicate.png',
                name: 'duplicate.png',
                createdAt: 2,
              },
              {
                id: `${'i'.repeat(MAX_CUSTOM_ICON_ID_CHARS)}x`,
                url: 'img:/app/.vlaina/app/assets/icons/too-long-id.png',
                name: 'too-long-id.png',
                createdAt: 3,
              },
              {
                id: 'too-long-url',
                url: 'u'.repeat(MAX_CUSTOM_ICON_URL_CHARS + 1),
                name: 'too-long-url.png',
                createdAt: 4,
              },
              {
                id: 'too-long-name',
                url: 'img:/app/.vlaina/app/assets/icons/too-long-name.png',
                name: `${'n'.repeat(MAX_CUSTOM_ICON_NAME_CHARS)}x`,
                createdAt: 5,
              },
              ...Array.from({ length: MAX_CUSTOM_ICONS + 10 }, (_, index) => ({
                id: `icon-${index + 1}`,
                url: `img:/app/.vlaina/app/assets/icons/icon-${index + 1}.png`,
                name: `icon-${index + 1}.png`,
                createdAt: index + 10,
              })),
            ],
            deletedCustomIconIds: [
              'deleted-0',
              'deleted-0',
              `${'d'.repeat(MAX_CUSTOM_ICON_ID_CHARS)}x`,
              ...Array.from({ length: MAX_DELETED_CUSTOM_ICON_IDS + 10 }, (_, index) => `deleted-${index + 1}`),
            ],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.customIcons).toHaveLength(MAX_CUSTOM_ICONS);
    expect(data.customIcons?.[0]?.id).toBe('icon-0');
    expect(data.customIcons?.some((icon) => icon.id === 'too-long-url')).toBe(false);
    expect(data.customIcons?.some((icon) => icon.id === 'too-long-name')).toBe(false);
    expect(data.deletedCustomIconIds).toHaveLength(MAX_DELETED_CUSTOM_ICON_IDS);
    expect(data.deletedCustomIconIds?.[0]).toBe('deleted-0');
    expect(data.deletedCustomIconIds).not.toContain(`${'d'.repeat(MAX_CUSTOM_ICON_ID_CHARS)}x`);
  });

  it('bounds orphan chat session recovery directory scans', async () => {
    const recoverableSessionId = `session-${MAX_ORPHAN_CHAT_SESSION_DIR_SCAN_ENTRIES - 1}`;
    const skippedSessionId = `session-${MAX_ORPHAN_CHAT_SESSION_DIR_SCAN_ENTRIES}`;
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith(`/chat/sessions/${recoverableSessionId}/messages.json`) ||
      path.endsWith(`/chat/sessions/${skippedSessionId}/messages.json`)
    ));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (!path.endsWith('/chat/sessions')) return [];
      return Array.from({ length: MAX_ORPHAN_CHAT_SESSION_DIR_SCAN_ENTRIES + 1 }, (_, index) => ({
        name: index === MAX_ORPHAN_CHAT_SESSION_DIR_SCAN_ENTRIES - 1
          ? recoverableSessionId
          : index === MAX_ORPHAN_CHAT_SESSION_DIR_SCAN_ENTRIES
            ? skippedSessionId
            : `temp-session-${index}`,
        path: `/appdata/.vlaina/chat/sessions/session-${index}`,
        isFile: false,
        isDirectory: true,
      }));
    });
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

      if (path.endsWith(`/chat/sessions/${recoverableSessionId}/messages.json`)) {
        return JSON.stringify({
          version: 1,
          sessionId: recoverableSessionId,
          updatedAt: 2,
          messages: [{
            id: 'm1',
            role: 'user',
            content: '<img src="https://example.com/orphan.png">\nRecover bounded orphan chat',
            modelId: '',
            timestamp: 10,
            versions: [{
              content: '<img src="https://example.com/orphan.png">\nRecover bounded orphan chat',
              createdAt: 10,
              kind: 'original',
              subsequentMessages: [],
            }],
            currentVersionIndex: 0,
          }],
        });
      }

      if (path.endsWith(`/chat/sessions/${skippedSessionId}/messages.json`)) {
        throw new Error('Out-of-budget orphan sessions must not be loaded');
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.sessions.map((session) => session.id)).toEqual([recoverableSessionId]);
    expect(data.ai?.sessions[0]?.title).toBe('Recover bounded orphan chat');
    expect(mocks.storage.readFile).not.toHaveBeenCalledWith(
      `/appdata/.vlaina/chat/sessions/${skippedSessionId}/messages.json`,
    );
  });

  it('bounds orphan provider file recovery when AI session metadata is invalid', async () => {
    const recoverableProviderId = `provider-${MAX_AI_PROVIDER_FILE_SCAN_ENTRIES - 1}`;
    const skippedProviderId = `provider-${MAX_AI_PROVIDER_FILE_SCAN_ENTRIES}`;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith('/chat/sessions/index.json') ||
      path.endsWith(`/chat/providers/${recoverableProviderId}.json`) ||
      path.endsWith(`/chat/providers/${skippedProviderId}.json`)
    ));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (!path.endsWith('/chat/providers')) return [];
      return Array.from({ length: MAX_AI_PROVIDER_FILE_SCAN_ENTRIES + 1 }, (_, index) => ({
        name: index === 0
          ? '../outside.json'
          : index === MAX_AI_PROVIDER_FILE_SCAN_ENTRIES - 1
            ? `${recoverableProviderId}.json`
            : index === MAX_AI_PROVIDER_FILE_SCAN_ENTRIES
              ? `${skippedProviderId}.json`
              : `skip-${index}.txt`,
        path: `/appdata/.vlaina/chat/providers/provider-${index}.json`,
        isFile: true,
        isDirectory: false,
      }));
    });
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
          sessions: [],
          providerIds: [recoverableProviderId],
        });
      }

      if (path.endsWith(`/chat/providers/${recoverableProviderId}.json`)) {
        return JSON.stringify({
          version: 1,
          providerId: recoverableProviderId,
          updatedAt: 1,
          data: {
            provider: {
              id: recoverableProviderId,
              name: 'Recovered Provider',
              type: 'newapi',
              apiHost: 'https://provider.example.com',
              apiKey: '',
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
            models: [{
              apiModelId: 'model-a',
              providerId: recoverableProviderId,
              enabled: true,
              createdAt: 1,
            }],
            fetchedModels: ['model-a'],
          },
        });
      }

      if (path.endsWith(`/chat/providers/${skippedProviderId}.json`)) {
        throw new Error('Out-of-budget provider files must not be loaded');
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    try {
      const data = await loadUnifiedData();

      expect(data.ai?.providers.map((provider) => provider.id)).toEqual([recoverableProviderId]);
      expect(data.ai?.models.map((model) => model.providerId)).toEqual([recoverableProviderId]);
      expect(data.ai?.fetchedModels).toEqual({ [recoverableProviderId]: ['model-a'] });
      expect(mocks.storage.readFile).not.toHaveBeenCalledWith(
        `/appdata/.vlaina/chat/providers/${skippedProviderId}.json`,
      );
      expect(mocks.storage.readFile).not.toHaveBeenCalledWith(
        '/appdata/.vlaina/chat/providers/../outside.json',
      );
      expect(warnSpy).toHaveBeenCalledWith(
        '[Storage] Ignoring invalid AI sessions file:',
        '/appdata/.vlaina/chat/sessions/index.json',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('recovers provider files when AI session metadata is missing', async () => {
    const providerId = 'recovered-provider';
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/app/settings.json') ||
      path.endsWith(`/chat/providers/${providerId}.json`)
    ));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (!path.endsWith('/chat/providers')) return [];
      return [
        { name: `${providerId}.json`, path: `/appdata/.vlaina/chat/providers/${providerId}.json`, isFile: true, isDirectory: false },
      ];
    });
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

      if (path.endsWith(`/chat/providers/${providerId}.json`)) {
        return JSON.stringify({
          version: 1,
          providerId,
          updatedAt: 1,
          data: {
            provider: {
              id: providerId,
              name: 'Recovered Provider',
              type: 'newapi',
              apiHost: 'https://provider.example.com',
              apiKey: '',
              enabled: true,
              createdAt: 1,
              updatedAt: 1,
            },
            models: [],
            fetchedModels: [],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.providers.map((provider) => provider.id)).toEqual([providerId]);
    expect(mocks.storage.readFile).not.toHaveBeenCalledWith('/appdata/.vlaina/chat/sessions/index.json');
  });
});
