import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useChatViewStoreState } from './useChatViewStoreState';

function createMessage(id: string, content: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    content,
    modelId: 'model-1',
    timestamp: 1,
    versions: [{ content, createdAt: 1, kind: 'original', subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

function setMessages(messages: ChatMessage[]) {
  useUnifiedStore.setState((state) => ({
    data: {
      ...state.data,
      ai: {
        ...state.data.ai!,
        sessions: [{ id: 'session-1', title: 'Test', modelId: 'model-1', createdAt: 1, updatedAt: 1 }],
        messages: { 'session-1': messages },
      },
    },
  }));
}

describe('useChatViewStoreState', () => {
  beforeEach(() => {
    useAIUIStore.setState({
      currentSessionId: 'session-1',
      generatingSessions: {},
    });
    setMessages([createMessage('message-1', 'First')]);
  });

  it('warms embedded content once without rerendering for inactive stream updates', () => {
    let renderCount = 0;
    const { result, rerender } = renderHook(
      ({ active }) => {
        renderCount += 1;
        return useChatViewStoreState(active, true);
      },
      { initialProps: { active: false } },
    );
    const warmedMessages = result.current.messages;
    const renderCountBeforeStreamUpdate = renderCount;

    act(() => {
      setMessages([...warmedMessages, createMessage('message-2', 'Streamed')]);
      useAIUIStore.setState({ generatingSessions: { 'session-1': true } });
    });

    expect(renderCount).toBe(renderCountBeforeStreamUpdate);
    expect(result.current.messages).toBe(warmedMessages);
    expect(result.current.isSessionActive).toBe(false);

    rerender({ active: true });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.isSessionActive).toBe(true);
  });

  it('does not warm a background full-page Chat view before first activation', () => {
    const { result } = renderHook(() => useChatViewStoreState(false, false));

    expect(result.current.currentSessionId).toBeNull();
    expect(result.current.messages).toEqual([]);
  });
});
