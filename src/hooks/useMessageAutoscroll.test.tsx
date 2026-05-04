import { act, render, renderHook, screen as rtlScreen } from '@testing-library/react';
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

    expect(result.current.spacerHeight).toBe(224);
  });

  it('clears the trailing spacer when streaming finishes', () => {
    const container = createScrollContainer();
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];
    const { result, rerender } = renderHook(
      ({ isStreaming }) =>
        useMessageAutoscroll({
          messages,
          isStreaming,
          chatId: 'chat-1',
          showLoading: false,
          estimateMessageHeight: () => 120,
        }),
      {
        initialProps: {
          isStreaming: true,
        },
      },
    );

    act(() => {
      result.current.containerRef.current = container;
    });
    act(() => {
      rerender({ isStreaming: true });
    });

    expect(result.current.spacerHeight).toBeGreaterThan(0);

    act(() => {
      rerender({ isStreaming: false });
    });

    expect(result.current.spacerHeight).toBe(0);
  });

  it('reserves spacer from the visible tail for an anchored overlong user message', () => {
    const container = createScrollContainer();
    const userMessage = createMessage('u1', 'user');
    const { result, rerender } = renderHook(
      ({ messages }) =>
        useMessageAutoscroll({
          messages,
          isStreaming: true,
          chatId: 'chat-1',
          showLoading: true,
          estimateLoadingHeight: () => 40,
          estimateMessageHeight: (message) => (message.id === 'u1' ? 1800 : 120),
        }),
      {
        initialProps: {
          messages: [] as ChatMessage[],
        },
      },
    );

    act(() => {
      result.current.containerRef.current = container;
    });
    act(() => {
      result.current.handleNewUserMessage();
    });
    act(() => {
      rerender({ messages: [userMessage] });
    });

    expect(result.current.spacerHeight).toBe(448);
  });

  it('keeps the current turn spacer after a short anchored response finishes', () => {
    const container = createScrollContainer();
    const initialMessages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];
    const messages = [
      ...initialMessages,
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];
    const { result, rerender } = renderHook(
      ({ isStreaming, messages }) =>
        useMessageAutoscroll({
          messages,
          isStreaming,
          chatId: 'chat-1',
          showLoading: false,
          estimateMessageHeight: () => 120,
        }),
      {
        initialProps: {
          isStreaming: false,
          messages: initialMessages,
        },
      },
    );

    act(() => {
      result.current.containerRef.current = container;
    });
    act(() => {
      result.current.handleNewUserMessage();
    });
    act(() => {
      rerender({ isStreaming: true, messages });
    });

    const streamingSpacerHeight = result.current.spacerHeight;
    expect(streamingSpacerHeight).toBeGreaterThan(0);

    act(() => {
      rerender({ isStreaming: false, messages });
    });

    expect(result.current.spacerHeight).toBeGreaterThan(0);
    expect(result.current.spacerHeight).toBeLessThan(streamingSpacerHeight);
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

  it('scrolls the current user message to the top after sending', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const container = createScrollContainer();
    const initialMessages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];
    const nextMessages = [
      ...initialMessages,
      createMessage('u2', 'user'),
    ];
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
      },
    );

    act(() => {
      result.current.containerRef.current = container;
    });
    act(() => {
      rerender({ messages: initialMessages });
    });
    act(() => {
      result.current.handleNewUserMessage();
    });
    act(() => {
      rerender({ messages: nextMessages });
    });

    expect(container.scrollTop).toBeGreaterThan(0);
    expect(container.scrollTop).toBeLessThan(container.scrollHeight);
    requestAnimationFrameSpy.mockRestore();
  });

  it('uses the rendered current user row as the exact top anchor', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable');
    const currentRow = rtlScreen.getByTestId('current-user-row');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 260,
      height: 80,
      left: 0,
      right: 900,
      top: 140,
      width: 900,
      x: 0,
      y: 140,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1240);
    requestAnimationFrameSpy.mockRestore();
  });

  it('shows only the tail of an overlong current user message after sending', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-long-user-anchor" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-long-user-row" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-long-user-anchor');
    const currentRow = rtlScreen.getByTestId('current-long-user-row');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2600,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 940,
      height: 760,
      left: 0,
      right: 900,
      top: 180,
      width: 900,
      x: 0,
      y: 180,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1944);
    requestAnimationFrameSpy.mockRestore();
  });

  it('keeps retrying when the browser clamps the first rendered-row anchor before spacer is applied', () => {
    const queuedFrames: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        queuedFrames.push(callback);
        return queuedFrames.length;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-clamped-anchor" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-clamped-anchor" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-clamped-anchor');
    const currentRow = rtlScreen.getByTestId('current-user-row-clamped-anchor');
    let scrollTop = 1000;
    let maxScrollTop = 1080;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => maxScrollTop + 600,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = Math.min(value, maxScrollTop);
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 340,
      height: 80,
      left: 0,
      right: 900,
      top: 260,
      width: 900,
      x: 0,
      y: 260,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1080);
    expect(queuedFrames.length).toBeGreaterThan(0);

    maxScrollTop = 1300;
    act(() => {
      while (queuedFrames.length > 0 && scrollTop !== 1240) {
        queuedFrames.shift()?.(0);
      }
    });

    expect(scrollTop).toBe(1240);
    requestAnimationFrameSpy.mockRestore();
  });

  it('anchors the current user row before the next animation frame after sending', () => {
    const queuedFrames: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        queuedFrames.push(callback);
        return queuedFrames.length;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-sync-anchor" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-sync-anchor" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-sync-anchor');
    const currentRow = rtlScreen.getByTestId('current-user-row-sync-anchor');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 260,
      height: 80,
      left: 0,
      right: 900,
      top: 140,
      width: 900,
      x: 0,
      y: 140,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1240);
    requestAnimationFrameSpy.mockRestore();
  });

  it('keeps the pending current-turn anchor when the first send creates a chat id', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [createMessage('u1', 'user')];

    function TestHarness({
      chatId,
      messages,
    }: {
      chatId: string | null;
      messages: ChatMessage[];
    }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId,
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-first-chat" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="0" data-testid="first-user-row" />
        </div>
      );
    }

    const view = render(<TestHarness chatId={null} messages={[]} />);
    const scrollable = rtlScreen.getByTestId('scrollable-first-chat');
    const currentRow = rtlScreen.getByTestId('first-user-row');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 260,
      height: 80,
      left: 0,
      right: 900,
      top: 140,
      width: 900,
      x: 0,
      y: 140,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness chatId="chat-1" messages={messages} />);
    });

    expect(scrollTop).toBe(1240);
    requestAnimationFrameSpy.mockRestore();
  });

  it('resets current-turn anchoring when switching chats after the pending send anchor is resolved', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const initialMessages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];
    const streamingMessages = [
      ...initialMessages,
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];
    const switchedMessages = [
      createMessage('u-other', 'user'),
      createMessage('a-other', 'assistant'),
    ];

    function TestHarness({
      chatId,
      isStreaming,
      messages,
    }: {
      chatId: string;
      isStreaming: boolean;
      messages: ChatMessage[];
    }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming,
        chatId,
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-chat-switch" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          {messages.map((_message, index) => (
            <div data-message-index={index} key={index} />
          ))}
        </div>
      );
    }

    const view = render(
      <TestHarness chatId="chat-1" isStreaming={false} messages={initialMessages} />,
    );
    const scrollable = rtlScreen.getByTestId('scrollable-chat-switch');
    let scrollTop = 900;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(
        <TestHarness chatId="chat-1" isStreaming messages={streamingMessages} />,
      );
    });

    expect(scrollTop).not.toBe(2400);

    act(() => {
      view.rerender(
        <TestHarness chatId="chat-2" isStreaming messages={switchedMessages} />,
      );
    });

    expect(scrollTop).toBe(2400);
    requestAnimationFrameSpy.mockRestore();
  });

  it('uses the previous rendered row to place the next user message when the target row is virtualized', () => {
    const queuedFrames: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        queuedFrames.push(callback);
        return queuedFrames.length;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
    ];

    function TestHarness({ messages, showTarget }: { messages: ChatMessage[]; showTarget: boolean }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-neighbor-anchor" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="1" data-testid="previous-assistant-row" />
          {showTarget ? <div data-message-index="2" data-testid="current-user-row-neighbor-anchor" /> : null}
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} showTarget={false} />);
    const scrollable = rtlScreen.getByTestId('scrollable-neighbor-anchor');
    const previousRow = rtlScreen.getByTestId('previous-assistant-row');
    let scrollTop = 800;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2600,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    previousRow.getBoundingClientRect = () => ({
      bottom: 540,
      height: 420,
      left: 0,
      right: 900,
      top: 120,
      width: 900,
      x: 0,
      y: 120,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} showTarget={false} />);
    });

    expect(scrollTop).toBe(1272);
    expect(queuedFrames.length).toBeGreaterThan(0);
    requestAnimationFrameSpy.mockRestore();
  });

  it('only scrolls by the overflowing output while the current turn is anchored', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-overflow" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-overflow" />
          <div data-message-index="3" data-testid="assistant-row-overflow" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-overflow');
    const currentRow = rtlScreen.getByTestId('current-user-row-overflow');
    const assistantRow = rtlScreen.getByTestId('assistant-row-overflow');
    let scrollTop = 1200;
    let assistantBottom = 760;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 260,
      height: 80,
      left: 0,
      right: 900,
      top: 180,
      width: 900,
      x: 0,
      y: 180,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: assistantBottom,
      height: 480,
      left: 0,
      right: 900,
      top: 280,
      width: 900,
      x: 0,
      y: 280,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1440);

    act(() => {
      scrollable.dispatchEvent(new Event('scroll'));
    });

    assistantBottom = 860;
    act(() => {
      view.rerender(
        <TestHarness
          messages={[
            ...messages.slice(0, 3),
            { ...messages[3]!, content: 'assistant-a2 expanded' },
          ]}
        />,
      );
    });

    expect(scrollTop).toBe(1700);
    requestAnimationFrameSpy.mockRestore();
  });

  it('prevents scrolling into trailing empty space while the current output is already visible', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-short-output" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-short-output" />
          <div data-message-index="3" data-testid="assistant-row-short-output" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-short-output');
    const currentRow = rtlScreen.getByTestId('current-user-row-short-output');
    const assistantRow = rtlScreen.getByTestId('assistant-row-short-output');
    let scrollTop = 1100;
    const userTop = 1200;
    const assistantTop = 1300;
    const assistantBottom = 1500;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2200,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: userTop + 80 - scrollTop,
      height: 80,
      left: 0,
      right: 900,
      top: userTop - scrollTop,
      width: 900,
      x: 0,
      y: userTop - scrollTop,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: assistantBottom - scrollTop,
      height: assistantBottom - assistantTop,
      left: 0,
      right: 900,
      top: assistantTop - scrollTop,
      width: 900,
      x: 0,
      y: assistantTop - scrollTop,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1200);

    act(() => {
      scrollTop = 1320;
      scrollable.dispatchEvent(new Event('scroll'));
    });

    expect(scrollTop).toBe(1200);
    requestAnimationFrameSpy.mockRestore();
  });

  it('uses the visible tail of an overlong user message when clamping trailing empty space', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-long-tail-clamp" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-long-tail-clamp" />
          <div data-message-index="3" data-testid="assistant-row-long-tail-clamp" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-long-tail-clamp');
    const currentRow = rtlScreen.getByTestId('current-user-row-long-tail-clamp');
    const assistantRow = rtlScreen.getByTestId('assistant-row-long-tail-clamp');
    let scrollTop = 1600;
    const userTop = 32;
    const userBottom = 1832;
    const assistantTop = 1850;
    const assistantBottom = 1940;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2600,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: userBottom - scrollTop,
      height: userBottom - userTop,
      left: 0,
      right: 900,
      top: userTop - scrollTop,
      width: 900,
      x: 0,
      y: userTop - scrollTop,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: assistantBottom - scrollTop,
      height: assistantBottom - assistantTop,
      left: 0,
      right: 900,
      top: assistantTop - scrollTop,
      width: 900,
      x: 0,
      y: assistantTop - scrollTop,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1736);

    act(() => {
      scrollable.dispatchEvent(new Event('scroll'));
    });

    expect(scrollTop).toBe(1736);

    act(() => {
      scrollTop = 1750;
      scrollable.dispatchEvent(new Event('scroll'));
    });

    expect(scrollTop).toBe(1736);
    requestAnimationFrameSpy.mockRestore();
  });

  it('scrolls to the output bottom when the current response is long', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-clamped" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-clamped" />
          <div data-message-index="3" data-testid="assistant-row-clamped" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-clamped');
    const currentRow = rtlScreen.getByTestId('current-user-row-clamped');
    const assistantRow = rtlScreen.getByTestId('assistant-row-clamped');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 180,
      height: 80,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: 760,
      height: 560,
      left: 0,
      right: 900,
      top: 200,
      width: 900,
      x: 0,
      y: 200,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1360);
    requestAnimationFrameSpy.mockRestore();
  });

  it('does not issue active follow scrolls for subpixel overflow', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-subpixel-overflow" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          <div data-message-index="2" data-testid="current-user-row-subpixel-overflow" />
          <div data-message-index="3" data-testid="assistant-row-subpixel-overflow" />
        </div>
      );
    }

    const view = render(<TestHarness messages={messages.slice(0, 2)} />);
    const scrollable = rtlScreen.getByTestId('scrollable-subpixel-overflow');
    const currentRow = rtlScreen.getByTestId('current-user-row-subpixel-overflow');
    const assistantRow = rtlScreen.getByTestId('assistant-row-subpixel-overflow');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2400,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    currentRow.getBoundingClientRect = () => ({
      bottom: 260,
      height: 80,
      left: 0,
      right: 900,
      top: 180,
      width: 900,
      x: 0,
      y: 180,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: 600.5,
      height: 320.5,
      left: 0,
      right: 900,
      top: 280,
      width: 900,
      x: 0,
      y: 280,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness messages={messages} />);
    });

    expect(scrollTop).toBe(1280);
    requestAnimationFrameSpy.mockRestore();
  });

  it('ignores queued streaming follow-up frames after the response completes', () => {
    const queuedFrames: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        queuedFrames.push(callback);
        return queuedFrames.length;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const messages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];

    function TestHarness({ isStreaming }: { isStreaming: boolean }) {
      const { containerRef } = useMessageAutoscroll({
        messages,
        isStreaming,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-complete-no-follow" ref={containerRef}>
          <div data-message-index="1" data-testid="assistant-row-complete-no-follow" />
        </div>
      );
    }

    const view = render(<TestHarness isStreaming />);
    const scrollable = rtlScreen.getByTestId('scrollable-complete-no-follow');
    const assistantRow = rtlScreen.getByTestId('assistant-row-complete-no-follow');
    let scrollTop = 1200;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 2600,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 600,
      height: 600,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: 780,
      height: 680,
      left: 0,
      right: 900,
      top: 100,
      width: 900,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    act(() => {
      view.rerender(<TestHarness isStreaming={false} />);
    });
    act(() => {
      while (queuedFrames.length > 0) {
        queuedFrames.shift()?.(0);
      }
    });

    expect(scrollTop).toBe(1200);
    requestAnimationFrameSpy.mockRestore();
  });

  it('restores the current turn anchor when completion clamp moves the row down', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const initialMessages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];
    const messages = [
      ...initialMessages,
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({
      isStreaming,
      messages,
    }: {
      isStreaming: boolean;
      messages: ChatMessage[];
    }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-completion-clamp" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          {messages.map((_message, index) => (
            <div
              data-message-index={index}
              data-testid={index === 2 ? 'current-user-row-completion-clamp' : index === 3 ? 'assistant-row-completion-clamp' : undefined}
              key={index}
            />
          ))}
        </div>
      );
    }

    const view = render(
      <TestHarness isStreaming={false} messages={initialMessages} />,
    );
    const scrollable = rtlScreen.getByTestId('scrollable-completion-clamp');
    let scrollTop = 319;
    const userTop = 319;
    const assistantTop = 420;
    const assistantBottom = 600;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 422,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 801,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 422,
      height: 422,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness isStreaming messages={messages} />);
    });

    const currentRow = rtlScreen.getByTestId('current-user-row-completion-clamp');
    const assistantRow = rtlScreen.getByTestId('assistant-row-completion-clamp');
    currentRow.getBoundingClientRect = () => ({
      bottom: userTop + 78 - scrollTop,
      height: 78,
      left: 0,
      right: 900,
      top: userTop - scrollTop,
      width: 900,
      x: 0,
      y: userTop - scrollTop,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: assistantBottom - scrollTop,
      height: assistantBottom - assistantTop,
      left: 0,
      right: 900,
      top: assistantTop - scrollTop,
      width: 900,
      x: 0,
      y: assistantTop - scrollTop,
      toJSON: () => ({}),
    });

    scrollTop = 255;
    act(() => {
      view.rerender(<TestHarness isStreaming={false} messages={messages} />);
    });

    expect(scrollTop).toBe(319);
    requestAnimationFrameSpy.mockRestore();
  });

  it('does not restore the current turn anchor after the user scrolls during streaming', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const initialMessages = [
      createMessage('u1', 'user'),
      createMessage('a1', 'assistant'),
    ];
    const messages = [
      ...initialMessages,
      createMessage('u2', 'user'),
      createMessage('a2', 'assistant'),
    ];

    function TestHarness({
      isStreaming,
      messages,
    }: {
      isStreaming: boolean;
      messages: ChatMessage[];
    }) {
      const { containerRef, handleNewUserMessage } = useMessageAutoscroll({
        messages,
        isStreaming,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable-completion-user-scroll" ref={containerRef}>
          <button type="button" onClick={handleNewUserMessage}>send</button>
          {messages.map((_message, index) => (
            <div
              data-message-index={index}
              data-testid={index === 2 ? 'current-user-row-completion-user-scroll' : index === 3 ? 'assistant-row-completion-user-scroll' : undefined}
              key={index}
            />
          ))}
        </div>
      );
    }

    const view = render(
      <TestHarness isStreaming={false} messages={initialMessages} />,
    );
    const scrollable = rtlScreen.getByTestId('scrollable-completion-user-scroll');
    let scrollTop = 319;
    const userTop = 319;
    const assistantTop = 420;
    const assistantBottom = 600;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 422,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 801,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
    scrollable.getBoundingClientRect = () => ({
      bottom: 422,
      height: 422,
      left: 0,
      right: 900,
      top: 0,
      width: 900,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    act(() => {
      rtlScreen.getByRole('button', { name: 'send' }).click();
    });
    act(() => {
      view.rerender(<TestHarness isStreaming messages={messages} />);
    });

    const currentRow = rtlScreen.getByTestId('current-user-row-completion-user-scroll');
    const assistantRow = rtlScreen.getByTestId('assistant-row-completion-user-scroll');
    currentRow.getBoundingClientRect = () => ({
      bottom: userTop + 78 - scrollTop,
      height: 78,
      left: 0,
      right: 900,
      top: userTop - scrollTop,
      width: 900,
      x: 0,
      y: userTop - scrollTop,
      toJSON: () => ({}),
    });
    assistantRow.getBoundingClientRect = () => ({
      bottom: assistantBottom - scrollTop,
      height: assistantBottom - assistantTop,
      left: 0,
      right: 900,
      top: assistantTop - scrollTop,
      width: 900,
      x: 0,
      y: assistantTop - scrollTop,
      toJSON: () => ({}),
    });

    scrollTop = 200;
    act(() => {
      scrollable.dispatchEvent(new Event('scroll'));
    });

    act(() => {
      view.rerender(<TestHarness isStreaming={false} messages={messages} />);
    });

    expect(scrollTop).toBe(200);
    requestAnimationFrameSpy.mockRestore();
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

  it('keeps the scroll listener stable across message updates', () => {
    const addEventListenerSpy = vi.spyOn(HTMLDivElement.prototype, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(HTMLDivElement.prototype, 'removeEventListener');

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef } = useMessageAutoscroll({
          messages,
          isStreaming: true,
          chatId: 'chat-1',
          showLoading: false,
      });
      return <div ref={containerRef} />;
    }

    const view = render(<TestHarness messages={[]} />);
    const isHookScrollListenerCall = ([event, _listener, options]: unknown[]) =>
      event === 'scroll' &&
      typeof options === 'object' &&
      options !== null &&
      'passive' in options &&
      options.passive === true;
    const scrollListenerCountAfterInitialRender = addEventListenerSpy.mock.calls.filter(
      isHookScrollListenerCall,
    ).length;

    view.rerender(<TestHarness messages={[createMessage('u1', 'user')]} />);

    view.rerender(
      <TestHarness messages={[createMessage('u1', 'user'), createMessage('a1', 'assistant')]} />,
    );

    expect(scrollListenerCountAfterInitialRender).toBeGreaterThan(0);
    expect(addEventListenerSpy.mock.calls.filter(isHookScrollListenerCall)).toHaveLength(
      scrollListenerCountAfterInitialRender,
    );
    expect(removeEventListenerSpy).not.toHaveBeenCalledWith('scroll', expect.any(Function));

    view.unmount();

    expect(removeEventListenerSpy.mock.calls.filter(([event]) => event === 'scroll')).toHaveLength(
      scrollListenerCountAfterInitialRender,
    );
  });

  it('keeps following the tail when the rendered message content grows', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    class ResizeObserverMock {
      static instances: ResizeObserverMock[] = [];

      callback: ResizeObserverCallback;
      observed: Element | null = null;
      observe = vi.fn((target: Element) => {
        this.observed = target;
      });
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        ResizeObserverMock.instances.push(this);
      }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);

    function TestHarness({ messages }: { messages: ChatMessage[] }) {
      const { containerRef } = useMessageAutoscroll({
        messages,
        isStreaming: true,
        chatId: 'chat-1',
        showLoading: false,
      });

      return (
        <div data-testid="scrollable" ref={containerRef}>
          <div data-testid="content" />
        </div>
      );
    }

    const view = render(
      <TestHarness messages={[createMessage('u1', 'user'), createMessage('a1', 'assistant')]} />,
    );
    const scrollable = rtlScreen.getByTestId('scrollable');
    let scrollTop = 900;

    Object.defineProperty(scrollable, 'clientHeight', {
      configurable: true,
      get: () => 600,
    });
    Object.defineProperty(scrollable, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });
    Object.defineProperty(scrollable, 'scrollHeight', {
      configurable: true,
      get: () => 1800,
    });
    Object.defineProperty(scrollable, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });

    view.rerender(
      <TestHarness messages={[createMessage('u1', 'user'), createMessage('a1', 'assistant')]} />,
    );

    const contentObserver = ResizeObserverMock.instances.find(
      (instance) => instance.observed === rtlScreen.getByTestId('content'),
    );
    expect(contentObserver).toBeTruthy();

    act(() => {
      contentObserver!.callback([], contentObserver! as unknown as ResizeObserver);
    });

    expect(scrollTop).toBe(1800);
    requestAnimationFrameSpy.mockRestore();
  });
});
