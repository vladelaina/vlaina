import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessageActions } from './messageActions';
import { useAIUIStore } from './chatState';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import type { ChatMessage } from '@/lib/ai/types';

const mocked = vi.hoisted(() => ({
  saveSessionJson: vi.fn(async () => {}),
  scheduleSessionJsonSave: vi.fn(),
}));

vi.mock('@/lib/storage/chatStorage', () => ({
  saveSessionJson: mocked.saveSessionJson,
  scheduleSessionJsonSave: mocked.scheduleSessionJsonSave,
}));

function createMessage(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id,
    role,
    content,
    modelId: 'model-1',
    timestamp: 1,
    versions: [{
      content,
      createdAt: 1,
      kind: 'original',
      subsequentMessages: [],
    }],
    currentVersionIndex: 0,
  };
}

function seedMessages(messages: ChatMessage[]) {
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

  useAIUIStore.setState({
    generatingSessions: {},
    unreadSessions: {},
    error: null,
    currentSessionId: 'session-1',
    temporaryChatEnabled: false,
    selectionInitialized: true,
    temporaryReturnSessionId: null,
    authPromptSessionId: null,
  });
}

describe('message action background session saves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.saveSessionJson.mockResolvedValue(undefined);
  });

  it('keeps an added message in memory when the immediate session save rejects', async () => {
    mocked.saveSessionJson.mockRejectedValueOnce(new Error('disk busy'));
    seedMessages([]);

    const addedId = createMessageActions().addMessage({
      role: 'user',
      content: 'hello',
      modelId: 'model-1',
    }, 'session-1');

    await Promise.resolve();

    const messages = useUnifiedStore.getState().data.ai?.messages['session-1'] ?? [];
    expect(addedId).toBe(messages[0]?.id);
    expect(messages[0]?.content).toBe('hello');
    expect(mocked.saveSessionJson).toHaveBeenCalledWith('session-1', messages);
  });

  it('keeps a regeneration version in memory when the immediate session save rejects', async () => {
    mocked.saveSessionJson.mockRejectedValueOnce(new Error('disk busy'));
    seedMessages([
      createMessage('user-1', 'user', 'prompt'),
      createMessage('assistant-1', 'assistant', 'answer'),
    ]);

    createMessageActions().addVersion('assistant-1', 'session-1');

    await Promise.resolve();

    const messages = useUnifiedStore.getState().data.ai?.messages['session-1'] ?? [];
    expect(messages[1]?.content).toBe('');
    expect(messages[1]?.versions).toHaveLength(2);
    expect(mocked.saveSessionJson).toHaveBeenCalledWith('session-1', messages);
  });
});
