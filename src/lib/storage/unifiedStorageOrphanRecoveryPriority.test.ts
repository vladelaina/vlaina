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
  MAX_AI_CHANNEL_CLEANUP_SCAN_ENTRIES,
  MAX_ORPHAN_CHAT_SESSION_FILE_SCAN_ENTRIES,
  loadUnifiedData,
} from './unifiedStorage';

function createMainDataPayload(): string {
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

describe('unifiedStorage orphan recovery priority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasElectronDesktopBridge.mockReturnValue(false);
    mocks.joinPath.mockImplementation(async (...parts: string[]) => parts.join('/'));
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 1024 });
  });

  it('does not spend orphan chat session recovery budget on non-session files', async () => {
    const sessionId = 'session-kept';
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/data.json') ||
      path.endsWith(`/chat/sessions/${sessionId}.json`)
    ));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (!path.endsWith('/chat/sessions')) return [];
      return [
        ...Array.from({ length: MAX_ORPHAN_CHAT_SESSION_FILE_SCAN_ENTRIES }, (_value, index) => ({
          name: `noise-${index}.txt`,
          path: `/appdata/.vlaina/chat/sessions/noise-${index}.txt`,
          isFile: true,
          isDirectory: false,
        })),
        {
          name: `${sessionId}.json`,
          path: `/appdata/.vlaina/chat/sessions/${sessionId}.json`,
          isFile: true,
          isDirectory: false,
        },
      ];
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return createMainDataPayload();
      }

      if (path.endsWith(`/chat/sessions/${sessionId}.json`)) {
        return JSON.stringify({
          version: 1,
          sessionId,
          updatedAt: 2,
          messages: [{
            id: 'm1',
            role: 'user',
            content: 'Recovered later chat',
            modelId: '',
            timestamp: 10,
            versions: [{
              content: 'Recovered later chat',
              createdAt: 10,
              kind: 'original',
              subsequentMessages: [],
            }],
            currentVersionIndex: 0,
          }],
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.sessions.map((session) => session.id)).toEqual([sessionId]);
    expect(data.ai?.sessions[0]?.title).toBe('Recovered later chat');
  });

  it('does not spend orphan provider recovery budget on non-channel files', async () => {
    const providerId = 'provider-kept';
    mocks.storage.exists.mockImplementation(async (path: string) => (
      path.endsWith('/.vlaina/data.json') ||
      path.endsWith(`/chat/channels/${providerId}.json`)
    ));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (!path.endsWith('/chat/channels')) return [];
      return [
        ...Array.from({ length: MAX_AI_CHANNEL_CLEANUP_SCAN_ENTRIES }, (_value, index) => ({
          name: `noise-${index}.txt`,
          path: `/appdata/.vlaina/chat/channels/noise-${index}.txt`,
          isFile: true,
          isDirectory: false,
        })),
        {
          name: '../outside.json',
          path: '/appdata/.vlaina/chat/channels/../outside.json',
          isFile: true,
          isDirectory: false,
        },
        {
          name: `${providerId}.json`,
          path: `/appdata/.vlaina/chat/channels/${providerId}.json`,
          isFile: true,
          isDirectory: false,
        },
      ];
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path.endsWith('/.vlaina/data.json')) {
        return createMainDataPayload();
      }

      if (path.endsWith(`/chat/channels/${providerId}.json`)) {
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
            fetchedModels: ['model-a'],
          },
        });
      }

      throw new Error(`Unexpected read: ${path}`);
    });

    const data = await loadUnifiedData();

    expect(data.ai?.providers.map((provider) => provider.id)).toEqual([providerId]);
    expect(data.ai?.fetchedModels).toEqual({ [providerId]: ['model-a'] });
    expect(mocks.storage.readFile.mock.calls.some(([path]) => (
      path === '/appdata/.vlaina/chat/channels/../outside.json'
    ))).toBe(false);
  });
});
