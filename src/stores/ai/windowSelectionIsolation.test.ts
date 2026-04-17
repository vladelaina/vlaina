import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, createAIChatSession, useAIStore } from '@/stores/useAIStore';
import { useAIUIStore } from './chatState';
import { useUnifiedStore } from '../unified/useUnifiedStore';

const mocked = vi.hoisted(() => {
  const managedStore = {
    refreshBudget: vi.fn(async () => {}),
    clearBudget: vi.fn(),
  };

  const accountState = {
    isConnected: false,
    checkStatus: vi.fn(async () => {}),
    handleAuthCallback: vi.fn(async () => false),
    hydrateAvatar: vi.fn(async () => {}),
  };

  return {
    saveUnifiedData: vi.fn(),
    loadUnifiedData: vi.fn(async () => ({
      settings: {},
      customIcons: [],
      ai: null,
    })),
    scanGlobalIcons: vi.fn(async () => []),
    saveSessionJson: vi.fn(async () => {}),
    scheduleSessionJsonSave: vi.fn(),
    cancelSessionJsonSave: vi.fn(),
    deleteSessionJson: vi.fn(async () => {}),
    loadSessionJson: vi.fn(async () => []),
    flushPendingSessionJsonSaves: vi.fn(async () => {}),
    readWindowLaunchContext: vi.fn(() => ({
      isNewWindow: false,
      vaultPath: null,
      notePath: null,
      viewMode: null as 'notes' | 'chat' | 'lab' | null,
    })),
    requestAbort: vi.fn(),
    refreshBudget: managedStore.refreshBudget,
    clearBudget: managedStore.clearBudget,
    useManagedAIStore: {
      getState: () => managedStore,
    },
    useAccountSessionStore: (selector: (state: typeof accountState) => unknown) => selector(accountState),
    runWithSessionMutationLock: vi.fn(async (_id: string, task: () => Promise<void> | void) => {
      await task();
    }),
    runWithSessionMutationLocks: vi.fn(async (_ids: string[], task: () => Promise<void> | void) => {
      await task();
    }),
  };
});

vi.mock('@/lib/storage/unifiedStorage', () => ({
  loadUnifiedData: mocked.loadUnifiedData,
  saveUnifiedData: mocked.saveUnifiedData,
}));

vi.mock('@/lib/storage/assetStorage', () => ({
  scanGlobalIcons: mocked.scanGlobalIcons,
}));

vi.mock('@/lib/storage/chatStorage', () => ({
  saveSessionJson: mocked.saveSessionJson,
  scheduleSessionJsonSave: mocked.scheduleSessionJsonSave,
  cancelSessionJsonSave: mocked.cancelSessionJsonSave,
  deleteSessionJson: mocked.deleteSessionJson,
  loadSessionJson: mocked.loadSessionJson,
  flushPendingSessionJsonSaves: mocked.flushPendingSessionJsonSaves,
}));

vi.mock('@/lib/tauri/windowLaunchContext', () => ({
  readWindowLaunchContext: mocked.readWindowLaunchContext,
}));

vi.mock('@/lib/ai/requestManager', () => ({
  requestManager: {
    abort: mocked.requestAbort,
  },
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: mocked.useManagedAIStore,
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: mocked.useAccountSessionStore,
}));

vi.mock('@/lib/ai/sessionMutationLock', () => ({
  runWithSessionMutationLock: mocked.runWithSessionMutationLock,
  runWithSessionMutationLocks: mocked.runWithSessionMutationLocks,
}));

const managedProvider = {
  id: 'vlaina-managed',
  name: 'vlaina',
  type: 'newapi' as const,
  apiHost: 'https://api.vlaina.com/v1',
  apiKey: '',
  enabled: true,
  createdAt: 1,
  updatedAt: 1,
};

const managedModel = {
  id: 'vlaina-managed:gpt-5',
  apiModelId: 'gpt-5',
  name: 'GPT-5',
  providerId: 'vlaina-managed',
  group: 'gpt',
  enabled: true,
  createdAt: 1,
};

function seedStores(overrides?: {
  currentSessionId?: string | null;
  temporaryChatEnabled?: boolean;
}) {
  useUnifiedStore.setState({
    loaded: true,
    data: {
      settings: {} as never,
      customIcons: [],
      ai: {
        providers: [managedProvider],
        models: [managedModel],
        benchmarkResults: {},
        fetchedModels: {},
        sessions: [
          {
            id: 'session-1',
            title: 'First',
            modelId: managedModel.id,
            createdAt: 1,
            updatedAt: 10,
          },
          {
            id: 'session-2',
            title: 'Second',
            modelId: managedModel.id,
            createdAt: 2,
            updatedAt: 20,
          },
        ],
        messages: {
          'session-1': [{ id: 'm1', role: 'user', content: 'hello', modelId: managedModel.id, timestamp: 1, versions: [{ content: 'hello', createdAt: 1, subsequentMessages: [] }], currentVersionIndex: 0 }],
          'session-2': [],
        },
        unreadSessionIds: [],
        selectedModelId: managedModel.id,
        currentSessionId: overrides?.currentSessionId ?? 'session-1',
        temporaryChatEnabled: overrides?.temporaryChatEnabled ?? false,
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
    currentSessionId: null,
    temporaryChatEnabled: false,
    selectionInitialized: false,
    temporaryReturnSessionId: null,
  });
}

describe('spark window selection isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.readWindowLaunchContext.mockReturnValue({
      isNewWindow: false,
      vaultPath: null,
      notePath: null,
      viewMode: null,
    });
    seedStores();
  });

  afterEach(() => {
    useAIUIStore.setState({
      generatingSessions: {},
      unreadSessions: {},
      error: null,
      currentSessionId: null,
      temporaryChatEnabled: false,
      selectionInitialized: false,
      temporaryReturnSessionId: null,
    });
  });

  it('initializes selection from shared state for a regular window', async () => {
    let hook:
      | {
          result: { current: ReturnType<typeof useAIStore> };
          unmount: () => void;
        }
      | undefined;
    await act(async () => {
      hook = renderHook(() => useAIStore());
    });

    const { result, unmount } = hook!;

    expect(result.current.currentSessionId).toBe('session-1');
    expect(result.current.temporaryChatEnabled).toBe(false);
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
    unmount();
  });

  it('initializes a new spark window with a blank local selection only', async () => {
    mocked.readWindowLaunchContext.mockReturnValue({
      isNewWindow: true,
      vaultPath: null,
      notePath: null,
      viewMode: 'chat',
    });

    let hook:
      | {
          result: { current: ReturnType<typeof useAIStore> };
          unmount: () => void;
        }
      | undefined;
    await act(async () => {
      hook = renderHook(() => useAIStore());
    });

    const { result, unmount } = hook!;

    expect(result.current.currentSessionId).toBe(null);
    expect(result.current.temporaryChatEnabled).toBe(false);
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
    unmount();
  });

  it('switches the active session locally without mutating shared selection', async () => {
    useAIUIStore.getState().setChatSelection({
      currentSessionId: 'session-1',
      temporaryChatEnabled: false,
    });

    await act(async () => {
      await actions.switchSession('session-2');
    });

    expect(useAIUIStore.getState().currentSessionId).toBe('session-2');
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
  });

  it('opens a blank new chat locally without mutating shared selection', () => {
    useAIUIStore.getState().setChatSelection({
      currentSessionId: 'session-1',
      temporaryChatEnabled: false,
    });

    act(() => {
      actions.openNewChat();
    });

    expect(useAIUIStore.getState().currentSessionId).toBe(null);
    expect(useAIUIStore.getState().temporaryChatEnabled).toBe(false);
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
  });

  it('enables temporary chat locally while keeping shared selection unchanged', () => {
    useAIUIStore.getState().setChatSelection({
      currentSessionId: 'session-1',
      temporaryChatEnabled: false,
    });

    act(() => {
      actions.toggleTemporaryChat(true);
    });

    expect(useAIUIStore.getState().temporaryChatEnabled).toBe(true);
    expect(useAIUIStore.getState().currentSessionId).toMatch(/^temp-session-/);
    expect(useUnifiedStore.getState().data.ai?.temporaryChatEnabled).toBe(false);
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
  });

  it('creates and selects a new session locally without rewriting shared selection fields', () => {
    useAIUIStore.getState().setChatSelection({
      currentSessionId: null,
      temporaryChatEnabled: false,
    });

    let createdSessionId = '';
    act(() => {
      createdSessionId = createAIChatSession('New Chat');
    });

    expect(createdSessionId).toMatch(/^session-/);
    expect(useAIUIStore.getState().currentSessionId).toBe(createdSessionId);
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
    expect(useUnifiedStore.getState().data.ai?.sessions.some((session) => session.id === createdSessionId)).toBe(true);
    expect(mocked.saveSessionJson).toHaveBeenCalledWith(createdSessionId, []);
  });

  it('stores unread state in shared ai data without mutating shared selection fields', () => {
    act(() => {
      useAIUIStore.getState().markSessionUnread('session-2');
    });

    expect(useUnifiedStore.getState().data.ai?.unreadSessionIds).toEqual(['session-2']);
    expect(useUnifiedStore.getState().data.ai?.currentSessionId).toBe('session-1');
  });

  it('clears shared unread state when the current session is marked read', () => {
    useUnifiedStore.setState((state) => ({
      ...state,
      data: {
        ...state.data,
        ai: state.data.ai
          ? {
              ...state.data.ai,
              unreadSessionIds: ['session-2'],
            }
          : state.data.ai,
      },
    }));

    act(() => {
      useAIUIStore.getState().markSessionRead('session-2');
    });

    expect(useUnifiedStore.getState().data.ai?.unreadSessionIds).toEqual([]);
  });
});
