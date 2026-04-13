import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { useMessageAutoscroll } from './useMessageAutoscroll';

function createMessage(id: string, role: ChatMessage['role']): ChatMessage {
  const content = `${role}-${id}`;
  const timestamp = Date.now();
  return {
    id,
    role,
    content,
    modelId: 'model-a',
    timestamp,
    versions: [{ content, createdAt: timestamp, subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

function createScrollContainer() {
  const element = document.createElement('div');
  let scrollTop = 0;

  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => 600,
  });

  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => 1800,
  });

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });

  return element as HTMLDivElement;
}

describe('useMessageAutoscroll', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrolls to the bottom when an existing chat hydrates after refresh', () => {
    const container = createScrollContainer();
    const { result, rerender } = renderHook(
      ({ messages, chatId }) =>
        useMessageAutoscroll({
          messages,
          isStreaming: false,
          chatId,
        }),
      {
        initialProps: {
          messages: [] as ChatMessage[],
          chatId: 'chat-1' as string | null,
        },
      }
    );

    act(() => {
      result.current.containerRef.current = container;
    });

    rerender({
      chatId: 'chat-1',
      messages: [createMessage('u1', 'user'), createMessage('a1', 'assistant')],
    });

    expect(container.scrollTop).toBe(container.scrollHeight);
  });
});
