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
    expect(completeMessage).not.toHaveBeenCalled();
    expect(setSessionLoading).toHaveBeenLastCalledWith('session-1', false);
  });
});
