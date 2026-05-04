import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runStreamedAssistantMessage } from './runStreamedAssistantMessage';

const requestManagerMocks = vi.hoisted(() => ({
  start: vi.fn(),
  finish: vi.fn(),
}));

vi.mock('@/lib/ai/requestManager', () => ({
  requestManager: requestManagerMocks,
}));

describe('runStreamedAssistantMessage', () => {
  beforeEach(() => {
    requestManagerMocks.start.mockReset();
    requestManagerMocks.finish.mockReset();
    requestManagerMocks.start.mockReturnValue(new AbortController());
  });

  it('streams content, resolves final content, and runs the success handler', async () => {
    const updateMessage = vi.fn();
    const completeMessage = vi.fn();
    const setSessionLoading = vi.fn();
    const setError = vi.fn();
    const onSuccess = vi.fn();

    const status = await runStreamedAssistantMessage({
      sessionId: 'session-1',
      assistantMessageId: 'assistant-1',
      execute: async (onChunk) => {
        onChunk('hello');
        return 'hello world';
      },
      updateMessage,
      completeMessage,
      setSessionLoading,
      setError,
      buildErrorPayload: () => ({ message: 'bad', xml: '<error>bad</error>' }),
      onSuccess,
    });

    expect(status).toBe('completed');
    expect(setSessionLoading).toHaveBeenNthCalledWith(1, 'session-1', true);
    expect(setSessionLoading).toHaveBeenLastCalledWith('session-1', false);
    expect(setError).toHaveBeenCalledWith(null);
    expect(updateMessage).toHaveBeenCalledWith('session-1', 'assistant-1', 'hello world');
    expect(completeMessage).toHaveBeenCalledWith('session-1', 'assistant-1');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(requestManagerMocks.start).toHaveBeenCalledWith('session-1');
    expect(requestManagerMocks.finish).toHaveBeenCalledTimes(1);
  });

  it('writes the error payload when the request fails', async () => {
    const updateMessage = vi.fn();
    const completeMessage = vi.fn();
    const setSessionLoading = vi.fn();
    const setError = vi.fn();

    const status = await runStreamedAssistantMessage({
      sessionId: 'session-1',
      assistantMessageId: 'assistant-1',
      execute: async () => {
        throw new Error('boom');
      },
      updateMessage,
      completeMessage,
      setSessionLoading,
      setError,
      buildErrorPayload: () => ({ message: 'Request failed', xml: '<error>Request failed</error>' }),
    });

    expect(status).toBe('failed');
    expect(setError).toHaveBeenLastCalledWith('Request failed');
    expect(updateMessage).toHaveBeenCalledWith('session-1', 'assistant-1', '<error>Request failed</error>');
    expect(completeMessage).not.toHaveBeenCalled();
    expect(setSessionLoading).toHaveBeenLastCalledWith('session-1', false);
  });

  it('treats aborts as a non-error outcome', async () => {
    const updateMessage = vi.fn();
    const completeMessage = vi.fn();
    const setSessionLoading = vi.fn();
    const setError = vi.fn();

    const status = await runStreamedAssistantMessage({
      sessionId: 'session-1',
      assistantMessageId: 'assistant-1',
      execute: async () => {
        throw new DOMException('aborted', 'AbortError');
      },
      updateMessage,
      completeMessage,
      setSessionLoading,
      setError,
      buildErrorPayload: () => ({ message: 'Request failed', xml: '<error>Request failed</error>' }),
    });

    expect(status).toBe('aborted');
    expect(setError).toHaveBeenCalledWith(null);
    expect(updateMessage).not.toHaveBeenCalled();
    expect(completeMessage).toHaveBeenCalledWith('session-1', 'assistant-1');
    expect(setSessionLoading).toHaveBeenLastCalledWith('session-1', false);
  });

  it('keeps streamed content when an aborted request reports a timeout-shaped error', async () => {
    const controller = new AbortController();
    requestManagerMocks.start.mockReturnValue(controller);
    const updateMessage = vi.fn();
    const completeMessage = vi.fn();
    const setSessionLoading = vi.fn();
    const setError = vi.fn();

    const status = await runStreamedAssistantMessage({
      sessionId: 'session-1',
      assistantMessageId: 'assistant-1',
      execute: async (onChunk) => {
        onChunk('already streamed');
        controller.abort();
        throw new Error('The AI request timed out.');
      },
      updateMessage,
      completeMessage,
      setSessionLoading,
      setError,
      buildErrorPayload: () => ({
        message: 'The request timed out. Please try again later.',
        xml: '<error>The request timed out. Please try again later.</error>',
      }),
    });

    expect(status).toBe('aborted');
    expect(setError).toHaveBeenCalledWith(null);
    expect(updateMessage).toHaveBeenLastCalledWith('session-1', 'assistant-1', 'already streamed');
    expect(updateMessage).not.toHaveBeenCalledWith(
      'session-1',
      'assistant-1',
      '<error>The request timed out. Please try again later.</error>',
    );
    expect(completeMessage).toHaveBeenCalledWith('session-1', 'assistant-1');
    expect(setSessionLoading).toHaveBeenLastCalledWith('session-1', false);
  });
});
