import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessageActions } from './messageActions';
import { useAIUIStore } from './chatState';
import { useUnifiedStore } from '../unified/useUnifiedStore';
import type { ChatMessage } from '@/lib/ai/types';
import { aliasSessionId, clearSessionIdAliases } from '@/lib/ai/sessionIdAliases';
import { saveSessionJson } from '@/lib/storage/chatStorage';
import { MAX_CHAT_MESSAGE_IMAGE_SOURCES } from '@/components/Chat/common/messageClipboard';

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
      kind: 'original' as const,
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
      kind: 'original' as const,
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
    clearSessionIdAliases();
  });

  it('clears the active top-level transcript when adding a regeneration version', () => {
    seedMessages([{
      ...createAssistantMessage(),
      imageSources: ['https://example.com/old.png'],
    }]);

    createMessageActions().addVersion('assistant-1', 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('');
    expect(message.apiTranscript).toBeUndefined();
    expect(message.imageSources).toEqual([]);
    expect(message.currentVersionIndex).toBe(1);
    expect(message.versions[0].apiTranscript?.[0].reasoning_content).toBe('old hidden reasoning');
    expect(message.versions[1].apiTranscript).toBeUndefined();
  });

  it('does not add regeneration versions to user messages', () => {
    seedMessages([createUserMessage('user-1', 'prompt')]);

    createMessageActions().addVersion('user-1', 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('prompt');
    expect(message.currentVersionIndex).toBe(0);
    expect(message.versions).toHaveLength(1);
    expect(message.versions[0].kind).toBe('original');
    expect(saveSessionJson).not.toHaveBeenCalled();
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

  it('does not edit and branch assistant messages', () => {
    seedMessages([createAssistantMessage(), createUserMessage('future-1')]);

    createMessageActions().editMessageAndBranch('session-1', 'assistant-1', 'edited answer');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe('old answer');
    expect(messages[0].currentVersionIndex).toBe(0);
    expect(messages[0].versions).toHaveLength(1);
  });

  it('does not switch assistant messages to edit versions', () => {
    seedMessages([{
      ...createAssistantMessage(),
      versions: [
        {
          content: 'old answer',
          createdAt: 1,
          kind: 'original' as const,
          subsequentMessages: [],
        },
        {
          content: 'bad edit version',
          createdAt: 2,
          kind: 'edit' as const,
          subsequentMessages: [],
        },
      ],
      currentVersionIndex: 0,
    }]);

    createMessageActions().switchMessageVersion('session-1', 'assistant-1', 1);

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('old answer');
    expect(message.currentVersionIndex).toBe(0);
  });

  it('does not switch user messages to regeneration versions', () => {
    seedMessages([{
      ...createUserMessage('user-1', 'prompt'),
      versions: [
        {
          content: 'prompt',
          createdAt: 1,
          kind: 'original' as const,
          subsequentMessages: [],
        },
        {
          content: 'bad regeneration version',
          createdAt: 2,
          kind: 'regeneration' as const,
          subsequentMessages: [],
        },
      ],
      currentVersionIndex: 0,
    }]);

    createMessageActions().switchMessageVersion('session-1', 'user-1', 1);

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.content).toBe('prompt');
    expect(message.currentVersionIndex).toBe(0);
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
        kind: 'original' as const,
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
    ]);
    expect(message.versions[0].apiTranscript).toEqual(message.apiTranscript);
  });

  it('routes added messages through promoted temporary session aliases', () => {
    seedMessages([]);
    aliasSessionId('temp-session-1', 'session-1');

    const addedId = createMessageActions().addMessage({
      role: 'user',
      content: 'after promotion',
      modelId: 'model-1',
    }, 'temp-session-1');

    const ai = useUnifiedStore.getState().data.ai!;
    expect(addedId).toMatch(/^msg-/);
    expect(ai.messages['session-1']).toHaveLength(1);
    expect(ai.messages['session-1'][0].content).toBe('after promotion');
    expect(ai.messages['temp-session-1']).toBeUndefined();
    expect(saveSessionJson).toHaveBeenCalledWith('session-1', ai.messages['session-1']);
  });

  it('assigns a unique id when adding a message with a duplicate id', () => {
    seedMessages([createUserMessage('duplicate', 'existing')]);

    const addedId = createMessageActions().addMessage({
      id: 'duplicate',
      role: 'user',
      content: 'new',
      modelId: 'model-1',
    }, 'session-1');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(addedId).toMatch(/^msg-/);
    expect(messages.map((message) => message.id)).toEqual(['duplicate', addedId]);
    expect(new Set(messages.map((message) => message.id))).toHaveLength(2);
  });

  it('checks hidden version branch ids before adding a message', () => {
    seedMessages([{
      ...createUserMessage('prompt-1', 'prompt'),
      versions: [{
        content: 'prompt',
        createdAt: 1,
        kind: 'original',
        subsequentMessages: [createAssistantMessage()],
      }],
    }]);

    const addedId = createMessageActions().addMessage({
      id: 'assistant-1',
      role: 'assistant',
      content: 'new answer',
      modelId: 'model-1',
    }, 'session-1');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(addedId).toMatch(/^msg-/);
    expect(messages[1].id).toBe(addedId);
    expect(messages[0].versions[0].subsequentMessages[0].id).toBe('assistant-1');
  });

  it('normalizes provided message ids before storing them', () => {
    seedMessages([]);

    const addedId = createMessageActions().addMessage({
      id: `  ${'x'.repeat(600)}  `,
      role: 'user',
      content: 'new',
      modelId: 'model-1',
    }, 'session-1');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(addedId).toBe('x'.repeat(512));
    expect(messages[0].id).toBe(addedId);
  });

  it('generates an id when a provided message id is blank', () => {
    seedMessages([]);

    const addedId = createMessageActions().addMessage({
      id: '   ',
      role: 'user',
      content: 'new',
      modelId: 'model-1',
    }, 'session-1');

    const messages = useUnifiedStore.getState().data.ai!.messages['session-1'];
    expect(addedId).toMatch(/^msg-/);
    expect(messages[0].id).toBe(addedId);
  });

  it('derives user message image sources only from markdown image tokens', () => {
    seedMessages([]);

    createMessageActions().addMessage({
      role: 'user',
      content: [
        '<img src="https://example.com/html.png">',
        '![real](https://example.com/markdown.png)',
      ].join('\n'),
      modelId: 'model-1',
    }, 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toEqual(['https://example.com/markdown.png']);
  });

  it('does not cache video markdown as user message image sources', () => {
    seedMessages([]);

    createMessageActions().addMessage({
      role: 'user',
      content: [
        '![video](https://example.com/movie.mp4)',
        '![real](https://example.com/photo.png)',
      ].join('\n'),
      modelId: 'model-1',
    }, 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toEqual(['https://example.com/photo.png']);
  });

  it('filters provided user message image source caches before storing', () => {
    seedMessages([]);

    createMessageActions().addMessage({
      role: 'user',
      content: [
        '![unsafe](http://127.0.0.1:3000/secret.png)',
        '![safe](attachment://safe.png)',
      ].join('\n'),
      imageSources: [
        'http://127.0.0.1:3000/secret.png',
        'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+',
        'https://example.com/movie.mp4',
        'attachment://safe.png',
      ],
      modelId: 'model-1',
    }, 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toEqual(['attachment://safe.png']);
  });

  it('bounds stored user message image source caches', () => {
    seedMessages([]);

    createMessageActions().addMessage({
      role: 'user',
      content: Array.from(
        { length: MAX_CHAT_MESSAGE_IMAGE_SOURCES + 1 },
        (_, index) => `![image ${index}](https://example.com/${index}.png)`,
      ).join('\n'),
      modelId: 'model-1',
    }, 'session-1');

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toHaveLength(MAX_CHAT_MESSAGE_IMAGE_SOURCES);
    expect(message.imageSources?.at(-1)).toBe(`https://example.com/${MAX_CHAT_MESSAGE_IMAGE_SOURCES - 1}.png`);
  });

  it('keeps assistant html images in derived message image sources', () => {
    seedMessages([createAssistantMessage()]);

    createMessageActions().updateMessage(
      'session-1',
      'assistant-1',
      '<img src="https://example.com/html.png">\n![real](https://example.com/markdown.png)',
    );

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toEqual([
      'https://example.com/html.png',
      'https://example.com/markdown.png',
    ]);
  });

  it('does not cache assistant video sources as image sources', () => {
    seedMessages([createAssistantMessage()]);

    createMessageActions().updateMessage(
      'session-1',
      'assistant-1',
      '<img src="https://example.com/movie.mp4">\n![real](https://example.com/markdown.png)',
    );

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toEqual(['https://example.com/markdown.png']);
  });

  it('keeps user edit version image sources aligned with markdown attachments', () => {
    seedMessages([createUserMessage('prompt-1', 'initial'), createAssistantMessage()]);

    createMessageActions().editMessageAndBranch(
      'session-1',
      'prompt-1',
      '<img src="https://example.com/html.png">\n![real](https://example.com/markdown.png)',
    );

    const message = useUnifiedStore.getState().data.ai!.messages['session-1'][0];
    expect(message.imageSources).toEqual(['https://example.com/markdown.png']);
  });

  it('routes version mutations through promoted temporary session aliases', () => {
    seedMessages([
      createUserMessage('prompt-1', 'prompt'),
      createAssistantMessage(),
    ]);
    const actions = createMessageActions();
    aliasSessionId('temp-session-1', 'session-1');

    actions.addVersion('assistant-1', 'temp-session-1');
    actions.switchMessageVersion('temp-session-1', 'assistant-1', 0);
    actions.editMessageAndBranch('temp-session-1', 'prompt-1', 'edited prompt');

    const ai = useUnifiedStore.getState().data.ai!;
    expect(ai.messages['temp-session-1']).toBeUndefined();
    expect(ai.messages['session-1']).toHaveLength(1);
    expect(ai.messages['session-1'][0].content).toBe('edited prompt');
    expect(ai.messages['session-1'][0].currentVersionIndex).toBe(1);
    expect(ai.messages['session-1'][0].versions[0].subsequentMessages[0].id).toBe('assistant-1');
  });

  it('does not recreate orphan message buckets for deleted sessions', () => {
    seedMessages([]);
    useUnifiedStore.setState((state) => ({
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          sessions: [],
          messages: {},
        },
      },
    }));
    const actions = createMessageActions();

    actions.addMessage({
      role: 'user',
      content: 'stale user message',
      modelId: 'model-1',
    }, 'session-1');
    actions.updateMessage('session-1', 'assistant-1', 'stale stream chunk');
    actions.updateMessageApiTranscript('session-1', 'assistant-1', [
      { role: 'assistant', content: 'stale transcript' },
    ]);
    actions.completeMessage('session-1', 'assistant-1');
    actions.addVersion('assistant-1', 'session-1');
    actions.editMessageAndBranch('session-1', 'prompt-1', 'edited after delete');
    actions.switchMessageVersion('session-1', 'assistant-1', 0);

    const ai = useUnifiedStore.getState().data.ai!;
    expect(ai.messages).toEqual({});
    expect(saveSessionJson).not.toHaveBeenCalled();
  });
});
