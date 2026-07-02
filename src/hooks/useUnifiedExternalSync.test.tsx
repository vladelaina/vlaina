import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnifiedExternalSync } from './useUnifiedExternalSync';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { ChatMessage } from '@/lib/ai/types';

const hoisted = vi.hoisted(() => ({
  listener: null as ((event: {
    kind: 'unified' | 'chat-session' | 'ui-preferences' | 'notes-starred';
    sourceId: string;
    stamp: number;
    nonce: string;
    sessionId?: string;
  }) => void) | null,
  reloadSessionMessagesFromDisk: vi.fn(async () => []),
  unsubscribe: vi.fn(),
}));

vi.mock('@/stores/ai/sessionConsistency', () => ({
  reloadSessionMessagesFromDisk: hoisted.reloadSessionMessagesFromDisk,
}));

vi.mock('@/lib/storage/storageAutoSync', () => ({
  emitStorageAutoSyncEvent: vi.fn(),
  subscribeStorageAutoSync: (listener: typeof hoisted.listener) => {
    hoisted.listener = listener;
    return hoisted.unsubscribe;
  },
}));

function createMessage(id: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: id,
    modelId: 'model-1',
    timestamp: 1,
    versions: [],
    currentVersionIndex: 0,
  };
}

function createAIData(messages: Record<string, ChatMessage[]> = {}) {
  return {
    providers: [],
    models: [],
    benchmarkResults: {},
    fetchedModels: {},
    sessions: [
      { id: 'session-1', title: 'One', modelId: 'model-1', createdAt: 1, updatedAt: 1 },
      { id: 'session-2', title: 'Two', modelId: 'model-1', createdAt: 2, updatedAt: 2 },
    ],
    messages,
    unreadSessionIds: [],
    selectedModelId: 'model-1',
    currentSessionId: 'session-1',
    temporaryChatEnabled: false,
    customSystemPrompt: '',
    includeTimeContext: true,
  };
}

function resetStores() {
  localStorage.clear();

  useUnifiedStore.setState({
    data: {
      settings: {
        timezone: { offset: 0, city: 'UTC' },
        markdown: { typewriterMode: false, codeBlock: { showLineNumbers: true } },
      },
      customIcons: [],
      ai: createAIData({
        'session-1': [createMessage('a')],
        'session-2': [createMessage('b')],
      }),
    },
    loaded: true,
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

  useUIStore.setState({
    fontSize: 17,
    languagePreference: 'system',
    imageStorageMode: 'subfolder',
    imageSubfolderName: 'assets',
    imageNotesRootSubfolderName: 'assets',
    imageFilenameFormat: 'original',
  });

  useNotesStore.setState({
    notesPath: '/notesRoot',
    loadStarred: vi.fn(async () => undefined),
  });
}

describe('useUnifiedExternalSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    hoisted.listener = null;
    resetStores();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reloads the active chat session after an external chat-session sync event', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'chat-session',
        sessionId: 'session-1',
        sourceId: 'other-window',
        stamp: 1,
        nonce: 'n1',
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.reloadSessionMessagesFromDisk).toHaveBeenCalledWith('session-1');
    expect(reloadFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('invalidates cached messages for an inactive session instead of eagerly reloading it', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'chat-session',
        sessionId: 'session-2',
        sourceId: 'other-window',
        stamp: 2,
        nonce: 'n2',
      });
      await Promise.resolve();
    });

    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();
    expect(useUnifiedStore.getState().data.ai?.messages).toEqual({
      'session-1': [createMessage('a')],
    });
    expect(reloadFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('does not invalidate an inactive session while that session is generating', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });
    useAIUIStore.setState({
      currentSessionId: 'session-1',
      generatingSessions: { 'session-2': true },
    });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'chat-session',
        sessionId: 'session-2',
        sourceId: 'other-window',
        stamp: 7,
        nonce: 'n7',
      });
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();
    expect(useUnifiedStore.getState().data.ai?.messages).toEqual({
      'session-1': [createMessage('a')],
      'session-2': [createMessage('b')],
    });

    await act(async () => {
      useAIUIStore.setState({ generatingSessions: {} });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();
    expect(useUnifiedStore.getState().data.ai?.messages).toEqual({
      'session-1': [createMessage('a')],
    });
    expect(reloadFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('reloads unified data while generation is active and defers only active session messages', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });
    useAIUIStore.setState({
      generatingSessions: { 'session-1': true },
    });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'unified',
        sourceId: 'other-window',
        stamp: 3,
        nonce: 'n3',
      });
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(reloadFromDisk).toHaveBeenCalledTimes(1);
    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();

    await act(async () => {
      useAIUIStore.setState({ generatingSessions: {} });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(reloadFromDisk).toHaveBeenCalledTimes(1);
    expect(hoisted.reloadSessionMessagesFromDisk).toHaveBeenCalledWith('session-1');

    hook.unmount();
  });

  it('reloads unified data during temporary chat but defers session message reloads', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });
    useAIUIStore.setState({
      currentSessionId: 'temp-session-1',
      temporaryChatEnabled: true,
    });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'unified',
        sourceId: 'other-window',
        stamp: 4,
        nonce: 'n4',
      });
      hoisted.listener?.({
        kind: 'chat-session',
        sessionId: 'temp-session-1',
        sourceId: 'other-window',
        stamp: 5,
        nonce: 'n5',
      });
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(reloadFromDisk).toHaveBeenCalledTimes(1);
    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('isolates rejected debounced unified reloads', async () => {
    const reloadFromDisk = vi.fn(async () => {
      throw new Error('reload failed');
    });
    useUnifiedStore.setState({ reloadFromDisk });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'unified',
        sourceId: 'other-window',
        stamp: 8,
        nonce: 'n8',
      });
      await vi.advanceTimersByTimeAsync(221);
    });

    expect(reloadFromDisk).toHaveBeenCalledTimes(1);

    hook.unmount();
  });

  it('reloads local UI preferences after an external ui-preferences sync event', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });

    const hook = renderHook(() => useUnifiedExternalSync());

    localStorage.setItem('fontSize', '17');
    localStorage.setItem('vlaina-language-preference', 'zh-CN');

    await act(async () => {
      hoisted.listener?.({
        kind: 'ui-preferences',
        sourceId: 'other-window',
        stamp: 4,
        nonce: 'n4',
      });
      await Promise.resolve();
    });

    expect(useUnifiedStore.getState().reloadFromDisk).not.toHaveBeenCalled();
    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();
    expect(useUIStore.getState()).toMatchObject({
      fontSize: 17,
      languagePreference: 'zh-CN',
    });

    hook.unmount();
  });

  it('reloads starred notes after an external notes-starred sync event', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    const loadStarred = vi.fn(async () => undefined);
    useUnifiedStore.setState({ reloadFromDisk });
    useNotesStore.setState({ notesPath: '/notes-root-a', loadStarred });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'notes-starred',
        sourceId: 'other-window',
        stamp: 6,
        nonce: 'n6',
      });
      await Promise.resolve();
    });

    expect(loadStarred).toHaveBeenCalledWith('/notes-root-a');
    expect(reloadFromDisk).not.toHaveBeenCalled();
    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });

  it('isolates rejected starred-note reloads', async () => {
    const reloadFromDisk = vi.fn(async () => undefined);
    const loadStarred = vi.fn(async () => {
      throw new Error('starred failed');
    });
    useUnifiedStore.setState({ reloadFromDisk });
    useNotesStore.setState({ notesPath: '/notes-root-a', loadStarred });

    const hook = renderHook(() => useUnifiedExternalSync());

    await act(async () => {
      hoisted.listener?.({
        kind: 'notes-starred',
        sourceId: 'other-window',
        stamp: 9,
        nonce: 'n9',
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(loadStarred).toHaveBeenCalledWith('/notes-root-a');
    expect(reloadFromDisk).not.toHaveBeenCalled();
    expect(hoisted.reloadSessionMessagesFromDisk).not.toHaveBeenCalled();

    hook.unmount();
  });
});
