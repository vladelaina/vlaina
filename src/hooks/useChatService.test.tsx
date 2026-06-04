import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatService } from './useChatService';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import type { AIModel, ApiTranscriptMessage, ChatMessage, ChatSendOptions, Provider } from '@/lib/ai/types';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';
import { runWithSessionMutationLock } from '@/lib/ai/sessionMutationLock';
import { convertToBase64, deleteAttachment, type Attachment } from '@/lib/storage/attachmentStorage';

const TEMPORARY_IMAGE_DATA_URL = 'data:image/png;base64,VEVNUE9SQVJZ';

const mocked = vi.hoisted(() => ({
  saveSessionJson: vi.fn(async () => {}),
  scheduleSessionJsonSave: vi.fn(),
  flushPendingSessionJsonSaves: vi.fn(async () => {}),
  loadSessionJson: vi.fn(async () => null as ChatMessage[] | null),
  useAccountSessionStore: (selector: (state: { isConnected: boolean }) => unknown) =>
    selector({ isConnected: true }),
  useManagedAIStore: {
    getState: () => ({
      budget: null,
      lastBudgetSyncAt: null,
      refreshBudget: vi.fn(async () => {}),
    }),
  },
  generateAutoTitle: vi.fn(async () => {}),
  convertToBase64: vi.fn(async () => TEMPORARY_IMAGE_DATA_URL),
  deleteAttachment: vi.fn(async () => {}),
  sendMessageWithEndpointFallback: vi.fn(async ({ onChunk }: { onChunk: (chunk: string) => void }) => {
    onChunk('assistant answer');
    return 'assistant answer';
  }),
}));

vi.mock('@/lib/storage/chatStorage', () => ({
  saveSessionJson: mocked.saveSessionJson,
  scheduleSessionJsonSave: mocked.scheduleSessionJsonSave,
  flushPendingSessionJsonSaves: mocked.flushPendingSessionJsonSaves,
  loadSessionJson: mocked.loadSessionJson,
  hasPendingSessionJsonSave: vi.fn(() => false),
}));

vi.mock('@/lib/storage/attachmentStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage/attachmentStorage')>();
  return {
    ...actual,
    convertToBase64: mocked.convertToBase64,
    deleteAttachment: mocked.deleteAttachment,
  };
});

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: mocked.useAccountSessionStore,
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: mocked.useManagedAIStore,
}));

vi.mock('./useAutoTitle', () => ({
  useAutoTitle: () => ({ generateAutoTitle: mocked.generateAutoTitle }),
}));

vi.mock('./chatService/sendMessageWithEndpointFallback', () => ({
  sendMessageWithEndpointFallback: mocked.sendMessageWithEndpointFallback,
}));

const provider: Provider = {
  id: 'provider-1',
  name: 'Provider',
  type: 'newapi',
  endpointType: 'openai',
  endpointTypeCheckedAt: 1,
  apiHost: 'https://example.test/v1',
  apiKey: 'sk-test',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

const model: AIModel = {
  id: 'model-1',
  apiModelId: 'model-1',
  name: 'Model',
  providerId: provider.id,
  enabled: true,
  createdAt: 1,
};

function createMessage(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id,
    role,
    content,
    modelId: model.id,
    timestamp: 1,
    versions: [{ content, createdAt: 1, kind: 'original', subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

function createAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    path: '',
    previewUrl: 'data:image/png;base64,PREVIEW',
    assetUrl: '',
    name: 'demo.png',
    type: 'image/png',
    size: 123,
    ...overrides,
  };
}

function seedTemporaryChatState() {
  useUnifiedStore.setState((state) => ({
    data: {
      ...state.data,
      ai: {
        ...state.data.ai!,
        sessions: [
          { id: 'temp-session-1', title: 'Temporary Chat', modelId: model.id, createdAt: 3, updatedAt: 3 },
          ...state.data.ai!.sessions,
        ],
        messages: {
          ...state.data.ai!.messages,
          'temp-session-1': [],
        },
        currentSessionId: 'temp-session-1',
        temporaryChatEnabled: true,
      },
    },
  }));
  useAIUIStore.setState({
    currentSessionId: 'temp-session-1',
    temporaryChatEnabled: true,
  });
}

function seedChatState() {
  useUnifiedStore.setState({
    loaded: true,
    data: {
      settings: {
        timezone: { offset: 8, city: 'Asia/Shanghai' },
      } as never,
      customIcons: [],
      ai: {
        providers: [provider],
        models: [model],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [
          { id: 'session-1', title: 'First', modelId: model.id, createdAt: 1, updatedAt: 1 },
          { id: 'session-2', title: 'Second', modelId: model.id, createdAt: 2, updatedAt: 2 },
        ],
        messages: {
          'session-1': [
            createMessage('s1-user', 'user', 'session one private prompt'),
            createMessage('s1-assistant', 'assistant', 'session one private answer'),
          ],
          'session-2': [
            createMessage('s2-user', 'user', 'session two visible prompt'),
            createMessage('s2-assistant', 'assistant', 'session two visible answer'),
          ],
        },
        unreadSessionIds: [],
        selectedModelId: model.id,
        currentSessionId: 'session-1',
        temporaryChatEnabled: false,
        customSystemPrompt: '',
        includeTimeContext: false,
        webSearchEnabled: false,
      },
    },
    undoStack: [],
  });

  useAIUIStore.setState({
    generatingSessions: {},
    unreadSessions: {},
    error: null,
    currentSessionId: 'session-2',
    temporaryChatEnabled: false,
    selectionInitialized: true,
    temporaryReturnSessionId: null,
    authPromptSessionId: null,
  });
}

describe('useChatService session context isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.convertToBase64.mockResolvedValue(TEMPORARY_IMAGE_DATA_URL);
    mocked.deleteAttachment.mockResolvedValue(undefined);
    seedChatState();
  });

  it('sends only the active session history to the provider request', async () => {
    const { result } = renderHook(() => useChatService());

    await act(async () => {
      const accepted = await result.current.sendMessage('new session two prompt', [], []);
      expect(accepted).toBe(true);
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);
    });

    const request = vi.mocked(sendMessageWithEndpointFallback).mock.calls[0]?.[0];
    expect(request?.content).toBe('new session two prompt');
    expect(request?.history.map((message) => message.content)).toEqual([
      'session two visible prompt',
      'session two visible answer',
    ]);
    expect(JSON.stringify(request?.history)).not.toContain('session one private');
  });

  it('releases the session mutation lock after starting a streamed request', async () => {
    let resolveProvider!: (value: string) => void;
    const pendingProviderResponse = new Promise<string>((resolve) => {
      resolveProvider = resolve;
    });
    mocked.sendMessageWithEndpointFallback.mockImplementationOnce(async ({ onChunk }: { onChunk: (chunk: string) => void }) => {
      onChunk('partial answer');
      return await pendingProviderResponse;
    });
    const { result } = renderHook(() => useChatService());

    await act(async () => {
      const accepted = await result.current.sendMessage('long running prompt', [], []);
      expect(accepted).toBe(true);
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);
    });

    let followUpMutationRan = false;
    const followUpMutation = runWithSessionMutationLock('session-2', () => {
      followUpMutationRan = true;
    });

    await waitFor(() => {
      expect(followUpMutationRan).toBe(true);
    });
    await followUpMutation;

    resolveProvider('final answer');
    await waitFor(() => {
      expect(useAIUIStore.getState().generatingSessions).toEqual({});
    });
  });

  it('does not call the provider when stopped before pre-request hydration completes', async () => {
    let resolvePendingHydration!: () => void;
    const pendingHydration = new Promise<void>((resolve) => {
      resolvePendingHydration = resolve;
    });
    mocked.flushPendingSessionJsonSaves.mockImplementationOnce(async () => {
      await pendingHydration;
    });

    const { result } = renderHook(() => useChatService());

    await act(async () => {
      expect(await result.current.sendMessage('cancel before provider', [], [])).toBe(true);
    });

    await waitFor(() => {
      expect(mocked.flushPendingSessionJsonSaves).toHaveBeenCalledTimes(1);
      expect(useAIUIStore.getState().generatingSessions).toEqual({ 'session-2': true });
    });

    act(() => {
      result.current.stop();
    });

    await act(async () => {
      resolvePendingHydration();
      await pendingHydration;
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).not.toHaveBeenCalled();
      expect(useAIUIStore.getState().generatingSessions).toEqual({});
    });

    const sessionMessages = useUnifiedStore.getState().data.ai?.messages['session-2'] || [];
    expect(sessionMessages.map((message) => message.content)).toEqual([
      'session two visible prompt',
      'session two visible answer',
    ]);
  });

  it('ignores stale API transcript callbacks after a newer request supersedes the stream', async () => {
    let resolveFirstProvider!: (value: string) => void;
    let firstTranscriptCallback: ((messages: ApiTranscriptMessage[]) => void) | undefined;
    const pendingFirstProviderResponse = new Promise<string>((resolve) => {
      resolveFirstProvider = resolve;
    });

    mocked.sendMessageWithEndpointFallback
      .mockImplementationOnce(async ({
        onChunk,
        options,
      }: {
        onChunk: (chunk: string) => void;
        options?: ChatSendOptions;
      }) => {
        firstTranscriptCallback = options?.onApiTranscript;
        onChunk('first partial answer');
        return await pendingFirstProviderResponse;
      })
      .mockImplementationOnce(async ({
        onChunk,
        options,
      }: {
        onChunk: (chunk: string) => void;
        options?: ChatSendOptions;
      }) => {
        onChunk('second answer');
        options?.onApiTranscript?.([{ role: 'assistant', content: 'second transcript' }]);
        return 'second answer';
      });

    const { result } = renderHook(() => useChatService());

    await act(async () => {
      expect(await result.current.sendMessage('first prompt', [], [])).toBe(true);
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);
      expect(firstTranscriptCallback).toBeTypeOf('function');
    });

    await act(async () => {
      expect(await result.current.sendMessage('second prompt', [], [])).toBe(true);
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(2);
      const messages = useUnifiedStore.getState().data.ai?.messages['session-2'] || [];
      expect(messages.at(-1)?.content).toBe('second answer');
    });

    act(() => {
      firstTranscriptCallback?.([{ role: 'assistant', content: 'stale first transcript' }]);
      resolveFirstProvider('stale first final');
    });

    await waitFor(() => {
      expect(useAIUIStore.getState().generatingSessions).toEqual({});
    });

    const messages = useUnifiedStore.getState().data.ai?.messages['session-2'] || [];
    expect(JSON.stringify(messages)).not.toContain('stale first transcript');
    expect(messages.some((message) => message.apiTranscript?.[0]?.content === 'second transcript')).toBe(true);
  });

  it('converts case-insensitive stored attachment URLs to ephemeral data URLs in temporary chat', async () => {
    seedTemporaryChatState();
    vi.mocked(convertToBase64).mockResolvedValueOnce(TEMPORARY_IMAGE_DATA_URL);
    const attachment = createAttachment({
      previewUrl: 'ATTACHMENT://demo.png',
      assetUrl: 'APP-FILE://attachment/demo.png',
    });

    const { result } = renderHook(() => useChatService());

    await act(async () => {
      expect(await result.current.sendMessage('describe it', [attachment], [])).toBe(true);
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);
    });

    expect(convertToBase64).toHaveBeenCalledWith(attachment);
    expect(deleteAttachment).toHaveBeenCalledWith(attachment);
    const messages = useUnifiedStore.getState().data.ai?.messages['temp-session-1'] || [];
    const userMessage = messages.find((message) => message.role === 'user');
    expect(userMessage?.content).toBe(`![image](<${TEMPORARY_IMAGE_DATA_URL}>)\n\ndescribe it`);
    expect(userMessage?.content).not.toContain('ATTACHMENT://');
    expect(userMessage?.content).not.toContain('APP-FILE://');
  });

  it('converts case-insensitive file attachment URLs to ephemeral data URLs in temporary chat', async () => {
    seedTemporaryChatState();
    vi.mocked(convertToBase64).mockResolvedValueOnce(TEMPORARY_IMAGE_DATA_URL);
    const attachment = createAttachment({
      previewUrl: '',
      assetUrl: 'FILE:///appdata/.vlaina/attachments/demo.png',
    });

    const { result } = renderHook(() => useChatService());

    await act(async () => {
      expect(await result.current.sendMessage('describe it', [attachment], [])).toBe(true);
    });

    await waitFor(() => {
      expect(sendMessageWithEndpointFallback).toHaveBeenCalledTimes(1);
    });

    expect(convertToBase64).toHaveBeenCalledWith(attachment);
    expect(deleteAttachment).toHaveBeenCalledWith(attachment);
    const messages = useUnifiedStore.getState().data.ai?.messages['temp-session-1'] || [];
    const userMessage = messages.find((message) => message.role === 'user');
    expect(userMessage?.content).toBe(`![image](<${TEMPORARY_IMAGE_DATA_URL}>)\n\ndescribe it`);
    expect(userMessage?.content).not.toContain('FILE://');
  });
});
