import { describe, expect, it, vi } from 'vitest';
import { registerManagedIpc } from '../../electron/managedIpc.mjs';

function registerHarness(overrides: Partial<Parameters<typeof registerManagedIpc>[0]> = {}) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const options = {
    handleIpc: (name: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(name, handler);
    },
    requestManagedJson: vi.fn(),
    requestManagedPublicJson: vi.fn(),
    fetchWithStoredSession: vi.fn(),
    managedApiBaseUrl: 'https://api.example.com/v1',
    createElectronBillingCheckout: vi.fn(),
    requireNonEmptyString: (value: unknown) => String(value ?? '').trim(),
    ...overrides,
  };

  registerManagedIpc(options);
  return { handlers, options };
}

function streamResponse(chunks: string[]) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  }));
}

describe('managed ipc stream bridge', () => {
  it('uses public managed requests for model listing only', async () => {
    const { handlers, options } = registerHarness();
    options.requestManagedPublicJson.mockResolvedValueOnce({ data: [] });
    options.requestManagedJson.mockResolvedValue({ success: true });

    await handlers.get('desktop:managed:get-models')?.();
    await handlers.get('desktop:managed:get-budget')?.();
    await handlers.get('desktop:managed:chat-completion')?.({}, {});
    await handlers.get('desktop:managed:image-generation')?.({}, { model: 'gpt-image-2', prompt: 'draw' });
    await handlers.get('desktop:managed:image-edit')?.({}, {
      bodyBase64: Buffer.from('multipart-body').toString('base64'),
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
    });

    expect(options.requestManagedPublicJson).toHaveBeenCalledWith('/models', { method: 'GET' });
    expect(options.requestManagedJson).toHaveBeenCalledWith('/budget', { method: 'GET' });
    expect(options.requestManagedJson).toHaveBeenCalledWith('/chat/completions', {
      method: 'POST',
      body: '{}',
    });
    expect(options.requestManagedJson).toHaveBeenCalledWith('/images/generations', {
      method: 'POST',
      body: '{"model":"gpt-image-2","prompt":"draw"}',
    });
    expect(options.requestManagedJson).toHaveBeenCalledWith('/images/edits', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
      body: Buffer.from('multipart-body'),
    });
  });

  it('does not require stored session credentials for managed model listing', async () => {
    const { handlers, options } = registerHarness();
    options.requestManagedPublicJson.mockResolvedValueOnce({ data: [] });

    await handlers.get('desktop:managed:get-models')?.();

    expect(options.requestManagedPublicJson).toHaveBeenCalledTimes(1);
    expect(options.requestManagedJson).not.toHaveBeenCalled();
    expect(options.fetchWithStoredSession).not.toHaveBeenCalled();
  });

  it('sanitizes managed chat completion message content before forwarding', async () => {
    const { handlers, options } = registerHarness();
    options.requestManagedJson.mockResolvedValue({ success: true });

    await handlers.get('desktop:managed:chat-completion')?.({}, {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'assistant',
          content: null,
          reasoning_content: 'hidden',
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'web_search', arguments: '{"query":"x"}' },
          }],
        },
        { role: 'tool', tool_call_id: 'call-1' },
      ],
    });

    expect(options.requestManagedJson).toHaveBeenCalledWith('/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'assistant',
            content: '',
            reasoning_content: 'hidden',
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: { name: 'web_search', arguments: '{"query":"x"}' },
            }],
          },
          { role: 'tool', tool_call_id: 'call-1', content: '' },
        ],
      }),
    });
  });

  it('sanitizes managed stream message content before forwarding', async () => {
    const fetchWithStoredSession = vi.fn(async () => streamResponse([
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    ]));
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-sanitize', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call-1',
            type: 'function',
            function: { name: 'web_search', arguments: '{"query":"x"}' },
          }],
        },
      ],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(JSON.parse(fetchWithStoredSession.mock.calls[0][1].body as string)).toMatchObject({
      model: 'deepseek-chat',
      messages: [{
        role: 'assistant',
        content: '',
        tool_calls: expect.any(Array),
      }],
    });
  });

  it('rejects unsafe stream request ids before starting a request', async () => {
    const { handlers, options } = registerHarness();

    await expect(
      handlers.get('desktop:managed:chat-completion-stream:start')?.(
        { sender: { isDestroyed: () => false, send: vi.fn() } },
        'managed\nother',
        {},
      ),
    ).rejects.toThrow('safe channel characters');
    expect(options.fetchWithStoredSession).not.toHaveBeenCalled();
  });

  it('does not let an old stream cleanup remove a newer stream with the same id', async () => {
    let closeFirstStream!: () => void;
    const signals: AbortSignal[] = [];
    const firstStream = new ReadableStream<Uint8Array>({
      start(controller) {
        closeFirstStream = () => controller.close();
      },
    });
    const secondStream = new ReadableStream<Uint8Array>({ start() {} });
    const fetchWithStoredSession = vi
      .fn()
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Response(firstStream);
      })
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Response(secondStream);
      });
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-1', {});
    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-1', {});
    closeFirstStream();
    await Promise.resolve();
    await Promise.resolve();

    await handlers.get('desktop:managed:chat-completion-stream:cancel')?.({}, 'managed-1');

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(true);
  });

  it('consumes the final SSE line without a trailing newline', async () => {
    const fetchWithStoredSession = vi.fn(async () => streamResponse([
      'data: {"choices":[{"delta":{"content":"final"}}]}',
    ]));
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-final', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-final:chunk', 'final');
    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-final:done', { content: 'final' });
  });

  it('surfaces managed stream error payloads', async () => {
    const fetchWithStoredSession = vi.fn(async () => streamResponse([
      'data: {"error":{"message":"upstream failed"}}\n\n',
    ]));
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-error', {});
    await Promise.resolve();
    await Promise.resolve();

    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-error:error', { message: 'upstream failed' });
  });

  it('extracts sanitized managed HTTP error payloads for streams', async () => {
    const fetchWithStoredSession = vi.fn(async () => new Response(
      JSON.stringify({
        success: false,
        error: 'UPSTREAM_UNAVAILABLE',
        errorCode: 'upstream_unavailable',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    ));
    const { handlers } = registerHarness({ fetchWithStoredSession });
    const sender = { isDestroyed: () => false, send: vi.fn() };

    await handlers.get('desktop:managed:chat-completion-stream:start')?.({ sender }, 'managed-http-error', {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sender.send).toHaveBeenCalledWith('desktop:managed:stream:managed-http-error:error', {
      message: 'UPSTREAM_UNAVAILABLE',
      statusCode: 502,
      errorCode: 'upstream_unavailable',
    });
  });
});
