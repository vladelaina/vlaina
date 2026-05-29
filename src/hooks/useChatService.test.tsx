import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatService } from './useChatService';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import type { AIModel, ChatMessage, Provider } from '@/lib/ai/types';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';

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
});
