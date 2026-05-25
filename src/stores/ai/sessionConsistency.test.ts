import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import { reloadSessionMessagesFromDisk } from './sessionConsistency';

const hoisted = vi.hoisted(() => ({
  flushPendingSessionJsonSaves: vi.fn(async () => undefined),
  hasPendingSessionJsonSave: vi.fn(() => false),
  loadSessionJson: vi.fn<() => Promise<ChatMessage[] | null>>(async () => null),
}));

vi.mock('@/lib/storage/chatStorage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/chatStorage')>('@/lib/storage/chatStorage');
  return {
    ...actual,
    flushPendingSessionJsonSaves: hoisted.flushPendingSessionJsonSaves,
    hasPendingSessionJsonSave: hoisted.hasPendingSessionJsonSave,
    loadSessionJson: hoisted.loadSessionJson,
  };
});

function createMessage(id: string, content: string): ChatMessage {
  return {
    id,
    role: 'user',
    content,
    modelId: 'model-1',
    timestamp: 1,
    versions: [{
      content,
      createdAt: 1,
      kind: 'original' as const,
      subsequentMessages: [],
    }],
    currentVersionIndex: 0,
  };
}

function seedSession(messages: ChatMessage[]) {
  useUnifiedStore.setState({
    loaded: true,
    data: {
      settings: {} as never,
      customIcons: [],
      ai: {
        providers: [],
        models: [],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [{ id: 'session-1', title: 'Chat', modelId: 'model-1', createdAt: 1, updatedAt: 1 }],
        messages: { 'session-1': messages },
        unreadSessionIds: [],
        selectedModelId: 'model-1',
        currentSessionId: 'session-1',
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: true,
      },
    },
    undoStack: [],
  });
}

describe('sessionConsistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.hasPendingSessionJsonSave.mockReturnValue(false);
    hoisted.loadSessionJson.mockResolvedValue(null);
    seedSession([createMessage('m1', 'local')]);
  });

  it('prefers disk content during external reload when there is no pending local write', async () => {
    hoisted.loadSessionJson.mockResolvedValue([createMessage('m1', 'external')]);

    const messages = await reloadSessionMessagesFromDisk('session-1');

    expect(messages[0]?.content).toBe('external');
    expect(messages[0]?.versions.map((version) => version.content)).toEqual(['external']);
    expect(useUnifiedStore.getState().data.ai?.messages['session-1']?.[0]?.content).toBe('external');
  });

  it('preserves pending local edits during external reload', async () => {
    hoisted.hasPendingSessionJsonSave.mockReturnValue(true);
    hoisted.loadSessionJson.mockResolvedValue([createMessage('m1', 'external')]);

    const messages = await reloadSessionMessagesFromDisk('session-1');

    expect(messages[0]?.content).toBe('local');
    expect(messages[0]?.versions.map((version) => version.content)).toEqual(['local']);
    expect(useUnifiedStore.getState().data.ai?.messages['session-1']?.[0]?.content).toBe('local');
  });
});
