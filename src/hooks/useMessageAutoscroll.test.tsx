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

  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    get: () => 900,
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
      static instances: ResizeObserverMock[] = [];

      observe = vi.fn();
      disconnect = vi.fn();

      constructor() {
        ResizeObserverMock.instances.push(this);
      }
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

  it('computes spacer height from custom estimated message sizes when DOM rows are unavailable', () => {
    const container = createScrollContainer();
    const { result, rerender } = renderHook(
      ({ messages }) =>
        useMessageAutoscroll({
          messages,
          isStreaming: true,
          chatId: 'chat-1',
          showLoading: false,
          estimateMessageHeight: (_message, _isStreaming, _containerWidth) => 120,
        }),
      {
        initialProps: {
          messages: [] as ChatMessage[],
        },
      }
    );

    act(() => {
      result.current.containerRef.current = container;
    });
    act(() => {
      rerender({
        messages: [
          createMessage('u1', 'user'),
          createMessage('a1', 'assistant'),
          createMessage('a2', 'assistant'),
        ],
      });
    });

    expect(result.current.spacerHeight).toBe(284);
  });

  it('computes spacer height from cached frame layout when no custom estimator is provided', () => {
    const container = createScrollContainer();
    const { result, rerender } = renderHook(
      ({ messages }) =>
        useMessageAutoscroll({
          messages,
          isStreaming: true,
          chatId: 'chat-1',
          showLoading: false,
        }),
      {
        initialProps: {
          messages: [] as ChatMessage[],
        },
      }
    );

    act(() => {
      result.current.containerRef.current = container;
    });
    act(() => {
      rerender({
        messages: [
          createMessage('u1', 'user'),
          createMessage('a1', 'assistant'),
          createMessage('a2', 'assistant'),
        ],
      });
    });

    expect(result.current.spacerHeight).toBeGreaterThan(0);
  });

  it('reuses a single ResizeObserver across message updates', () => {
    const ResizeObserverMock = globalThis.ResizeObserver as unknown as {
      instances: Array<{ observe: () => void; disconnect: () => void }>;
    };
    const container = createScrollContainer();
    const { result, rerender, unmount } = renderHook(
      ({ messages }) =>
        useMessageAutoscroll({
          messages,
          isStreaming: true,
          chatId: 'chat-1',
          showLoading: false,
        }),
      {
        initialProps: {
          messages: [] as ChatMessage[],
        },
      }
    );

    act(() => {
      result.current.containerRef.current = container;
    });

    rerender({
      messages: [createMessage('u1', 'user')],
    });

    rerender({
      messages: [createMessage('u1', 'user'), createMessage('a1', 'assistant')],
    });

    expect(ResizeObserverMock.instances).toHaveLength(1);

    unmount();

    expect(ResizeObserverMock.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });
});
