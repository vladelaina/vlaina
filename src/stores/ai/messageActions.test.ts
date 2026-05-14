import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessageActions } from './messageActions';
import { useAIUIStore } from './chatState';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import type { ChatMessage } from '@/lib/ai/types';

vi.mock('@/lib/storage/chatStorage', () => ({
  saveSessionJson: vi.fn(async () => {}),
  scheduleSessionJsonSave: vi.fn(),
}));

function createAssistantMessage(): ChatMessage {
  const apiTranscript = [{
    role: 'assistant',
    content: 'old answer',
    reasoning_content: 'old hidden reasoning',
  }];
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: 'old answer',
    apiTranscript,
    modelId: 'model-1',
    timestamp: 1,
    versions: [{
      content: 'old answer',
      createdAt: 1,
      subsequentMessages: [],
      apiTranscript,
    }],
    currentVersionIndex: 0,
  };
}

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

describe('message actions API transcript handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears the active top-level transcript when adding a regeneration version', () => {
    seedMessages([createAssistantMessage()]);

    createMessageActions().addVersion('assistant-1', 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('');
    expect(message.apiTranscript).toBeUndefined();
    expect(message.currentVersionIndex).toBe(1);
    expect(message.versions[0].apiTranscript?.[0].reasoning_content).toBe('old hidden reasoning');
    expect(message.versions[1].apiTranscript).toBeUndefined();
  });

  it('restores the selected version transcript when switching versions', () => {
    seedMessages([createAssistantMessage()]);
    const actions = createMessageActions();

    actions.addVersion('assistant-1', 'session-1');
    actions.switchMessageVersion('session-1', 'assistant-1', 0);

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('old answer');
    expect(message.apiTranscript?.[0].reasoning_content).toBe('old hidden reasoning');
  });

  it('can add a regeneration version to legacy messages without version metadata', () => {
    seedMessages([{
      id: 'legacy-assistant',
      role: 'assistant',
      content: 'legacy answer',
      modelId: 'model-1',
      timestamp: 1,
      apiTranscript: [{ role: 'assistant', content: 'legacy answer', reasoning_content: 'hidden' }],
    } as unknown as ChatMessage]);

    createMessageActions().addVersion('legacy-assistant', 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('');
    expect(message.currentVersionIndex).toBe(1);
    expect(message.versions[0]).toMatchObject({
      content: 'legacy answer',
      createdAt: 1,
      apiTranscript: [{ role: 'assistant', content: 'legacy answer', reasoning_content: 'hidden' }],
    });
  });

  it('can edit and branch legacy messages without version metadata', () => {
    seedMessages([
      {
        id: 'legacy-user',
        role: 'user',
        content: 'legacy prompt',
        modelId: 'model-1',
        timestamp: 1,
      } as unknown as ChatMessage,
      createAssistantMessage(),
    ]);

    createMessageActions().editMessageAndBranch('session-1', 'legacy-user', 'edited prompt');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('edited prompt');
    expect(messages[0].currentVersionIndex).toBe(1);
    expect(messages[0].versions[0].subsequentMessages[0].id).toBe('assistant-1');
  });

  it('limits retained message versions while preserving the active version', () => {
    seedMessages([createAssistantMessage()]);
    const actions = createMessageActions();

    for (let index = 0; index < 25; index += 1) {
      actions.addVersion('assistant-1', 'session-1');
    }

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.versions).toHaveLength(20);
    expect(message.currentVersionIndex).toBe(19);
    expect(message.content).toBe('');
  });

  it('limits branched subsequent messages and strips deeper nested branches', () => {
    const nestedAssistant: ChatMessage = {
      ...createAssistantMessage(),
      id: 'nested-assistant',
      versions: [{
        content: 'nested',
        createdAt: 1,
        subsequentMessages: [createUserMessage('deep-1')],
      }],
    };
    seedMessages([
      createUserMessage('prompt-1', 'prompt'),
      ...Array.from({ length: 120 }, (_, index) =>
        index === 0 ? nestedAssistant : createUserMessage(`future-${index}`)
      ),
    ]);

    createMessageActions().editMessageAndBranch('session-1', 'prompt-1', 'edited prompt');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    const branch = message.versions[0].subsequentMessages;
    expect(branch).toHaveLength(100);
    expect(branch[0].id).toBe('nested-assistant');
    expect(branch[0].versions[0].subsequentMessages).toEqual([]);
  });

  it('normalizes transcripts at the message mutation boundary', () => {
    seedMessages([createAssistantMessage()]);

    createMessageActions().updateMessageApiTranscript('session-1', 'assistant-1', [
      { role: 'assistant', content: 'new answer', reasoning_content: 'hidden' },
      { role: 'tool', content: 'missing tool id' },
      { role: 'tool', tool_call_id: 'call-1', content: 'result' },
      { role: 'invalid', content: 'bad' },
    ]);

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.apiTranscript).toEqual([
      { role: 'assistant', content: 'new answer', reasoning_content: 'hidden' },
      { role: 'tool', tool_call_id: 'call-1', content: 'result' },
    ]);
    expect(message.versions[0].apiTranscript).toEqual(message.apiTranscript);
  });
});
