import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage, MessageVersion } from '@/lib/ai/types';
import { createMessageActions } from './messageActions';
import { useAIUIStore } from './chatState';
import { useUnifiedStore } from '../unified/useUnifiedStore';

vi.mock('@/lib/storage/chatStorage', () => ({
  saveSessionJson: vi.fn(async () => {}),
  scheduleSessionJsonSave: vi.fn(),
}));

function createUserMessage(id: string, content = id): ChatMessage {
  return {
    id,
    role: 'user',
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
  });
}

describe('message action id scan bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('limits hidden branch id scans to retained versions', () => {
    const versions: MessageVersion[] = [
      {
        content: 'active',
        createdAt: 1,
        kind: 'original',
        subsequentMessages: [createUserMessage('hidden-branch')],
      },
    ];
    Object.defineProperty(versions, '1', {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error('Unretained version should not be scanned');
      },
    });
    for (let index = 2; index < 22; index += 1) {
      versions[index] = {
        content: `old-${index}`,
        createdAt: index,
        kind: 'edit',
        subsequentMessages: [],
      };
    }

    seedMessages([{
      ...createUserMessage('prompt-1', 'active'),
      versions,
      currentVersionIndex: 0,
    }]);

    const addedId = createMessageActions().addMessage({
      id: 'hidden-branch',
      role: 'user',
      content: 'new prompt',
      modelId: 'model-1',
    }, 'session-1');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(addedId).toMatch(/^msg-/);
    expect(messages[1].id).toBe(addedId);
  });
});
