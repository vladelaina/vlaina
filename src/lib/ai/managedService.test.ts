import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  hasElectronDesktopBridgeMock,
  clearClientSessionMock,
  getManagedModelsMock,
  getManagedModelsVersionMock,
  managedChatCompletionMock,
  managedChatCompletionStreamMock,
} = vi.hoisted(() => ({
  hasElectronDesktopBridgeMock: vi.fn(),
  clearClientSessionMock: vi.fn(),
  getManagedModelsMock: vi.fn(),
  getManagedModelsVersionMock: vi.fn(),
  managedChatCompletionMock: vi.fn(),
  managedChatCompletionStreamMock: vi.fn(),
}));

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: hasElectronDesktopBridgeMock,
}));

vi.mock('@/lib/account/desktopCommands', () => ({
  accountCommands: {
    getManagedModels: getManagedModelsMock,
    getManagedModelsVersion: getManagedModelsVersionMock,
    getManagedBudget: vi.fn(),
    managedChatCompletion: managedChatCompletionMock,
    managedChatCompletionStream: managedChatCompletionStreamMock,
  },
}));

vi.mock('@/lib/account/webCommands', () => ({
  webAccountCommands: {
    clearClientSession: clearClientSessionMock,
  },
}));

describe('managedService', () => {
  beforeEach(() => {
    vi.resetModules();
    hasElectronDesktopBridgeMock.mockReset();
    clearClientSessionMock.mockReset();
    getManagedModelsMock.mockReset();
    getManagedModelsVersionMock.mockReset();
    managedChatCompletionMock.mockReset();
    managedChatCompletionStreamMock.mockReset();
    vi.restoreAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('uses credentialed web requests for managed models', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: 'gpt-4o-mini', display_name: 'GPT-4o Mini' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModels } = await import('./managedService');
    const models = await fetchManagedModels();

    expect(models).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/v1/models', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: expect.any(AbortSignal),
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('uses lightweight web requests for managed model versions', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        model_catalog_version: 'v1',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModelsVersion } = await import('./managedService');
    const version = await fetchManagedModelsVersion();

    expect(version).toBe('v1');
    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/v1/models/version', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      signal: expect.any(AbortSignal),
      headers: {
        Accept: 'application/json',
      },
    });
  });

  it('preserves client session when managed web auth is rejected', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModels, MANAGED_AUTH_REQUIRED_ERROR } = await import('./managedService');

    await expect(fetchManagedModels()).rejects.toThrow(MANAGED_AUTH_REQUIRED_ERROR);
    expect(clearClientSessionMock).not.toHaveBeenCalled();
  });

  it('extracts nested managed web error messages', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: { message: 'upstream overloaded' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModels } = await import('./managedService');

    await expect(fetchManagedModels()).rejects.toThrow('Managed API request failed: HTTP 500');
    expect(clearClientSessionMock).not.toHaveBeenCalled();
  });

  it('sanitizes managed web forbidden business errors without clearing session', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: 'Model is not available for this user', errorCode: 'points_exhausted' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { requestManagedChatCompletion } = await import('./managedService');

    await expect(requestManagedChatCompletion({ model: 'unpublished-model' })).rejects.toThrow('MANAGED_QUOTA_EXHAUSTED');
    expect(clearClientSessionMock).not.toHaveBeenCalled();
  });

  it('sanitizes managed chat completion bodies before web requests', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { requestManagedChatCompletion } = await import('./managedService');

    await requestManagedChatCompletion({
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

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.messages).toEqual([
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
    ]);
  });

  it('sanitizes managed chat completion bodies before desktop bridge requests', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true);
    managedChatCompletionMock.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

    const { requestManagedChatCompletion } = await import('./managedService');

    await requestManagedChatCompletion({
      model: 'deepseek-chat',
      messages: [{
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'web_search', arguments: '{"query":"x"}' },
        }],
      }],
    });

    expect(managedChatCompletionMock).toHaveBeenCalledWith({
      model: 'deepseek-chat',
      messages: [{
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'web_search', arguments: '{"query":"x"}' },
        }],
      }],
    });
  });

  it('treats auth and network failures as recoverable managed service errors', async () => {
    const { isManagedServiceRecoverableError, MANAGED_AUTH_REQUIRED_ERROR } = await import('./managedService');

    expect(isManagedServiceRecoverableError(new Error(MANAGED_AUTH_REQUIRED_ERROR))).toBe(true);
    expect(
      isManagedServiceRecoverableError(
        'Managed API request failed: error sending request for url (https://api.vlaina.com/v1/models)'
      )
    ).toBe(true);
    expect(
      isManagedServiceRecoverableError(
        new Error('Managed API request failed: error sending request for url (https://api.vlaina.com/v1/models)')
      )
    ).toBe(true);
    expect(isManagedServiceRecoverableError(new Error('Failed to fetch'))).toBe(true);
    expect(
      isManagedServiceRecoverableError(
        new Error("Error invoking remote method 'desktop:managed:get-models': TypeError: fetch failed")
      )
    ).toBe(true);
    expect(isManagedServiceRecoverableError(new Error('Unexpected JSON shape'))).toBe(false);
  });

  it('keeps desktop managed model requests inside desktop commands', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true);
    getManagedModelsMock.mockResolvedValue({
      data: [{ id: 'gpt-4o-mini' }],
    });

    const { fetchManagedModels } = await import('./managedService');
    const models = await fetchManagedModels();

    expect(models[0]?.apiModelId).toBe('gpt-4o-mini');
    expect(getManagedModelsMock).toHaveBeenCalledTimes(1);
  });

  it('keeps desktop managed model version requests inside desktop commands', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true);
    getManagedModelsVersionMock.mockResolvedValue({
      success: true,
      model_catalog_version: 'v1',
    });

    const { fetchManagedModelsVersion } = await import('./managedService');
    const version = await fetchManagedModelsVersion();

    expect(version).toBe('v1');
    expect(getManagedModelsVersionMock).toHaveBeenCalledTimes(1);
  });

  it('streams managed chat completions on web', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              [
                'data: {"choices":[{"delta":{"reasoning_content":"思考中"}}]}',
                'data: {"choices":[{"delta":{"content":"你好"}}]}',
                'data: [DONE]',
                '',
              ].join('\n')
            )
          );
          controller.close();
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { requestManagedChatCompletionStream } = await import('./managedService');
    const chunks: string[] = [];
    const content = await requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      (chunk) => chunks.push(chunk)
    );

    expect(content).toBe('<think>思考中</think>你好');
    expect(chunks[chunks.length - 1]).toBe('<think>思考中</think>你好');
    expect(fetchMock).toHaveBeenCalledWith('https://api.vlaina.com/v1/chat/completions', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      },
      signal: expect.any(AbortSignal),
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      }),
    });
  });

  it('keeps resumed managed reasoning hidden after visible content has started', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              [
                'data: {"choices":[{"delta":{"reasoning_content":"first"}}]}',
                'data: {"choices":[{"delta":{"content":"visible"}}]}',
                'data: {"choices":[{"delta":{"reasoning_content":"second"}}]}',
                'data: {"choices":[{"delta":{"content":" answer"}}]}',
                'data: [DONE]',
                '',
              ].join('\n')
            )
          );
          controller.close();
        },
      }),
    }));

    const { requestManagedChatCompletionStream } = await import('./managedService');
    const chunks: string[] = [];
    const content = await requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      (chunk) => chunks.push(chunk)
    );

    expect(content).toBe('<think>first</think>visible<think>second</think> answer');
    expect(chunks[chunks.length - 1]).toBe('<think>first</think>visible<think>second</think> answer');
  });

  it('consumes the final managed SSE data line even without a trailing newline', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"final token"}}]}')
          );
          controller.close();
        },
      }),
    }));

    const { requestManagedChatCompletionStream } = await import('./managedService');
    const chunks: string[] = [];
    const content = await requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      (chunk) => chunks.push(chunk)
    );

    expect(content).toBe('final token');
    expect(chunks).toEqual(['final token']);
  });

  it('parses managed stream message chunks as assistant content', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              [
                'data: {"choices":[{"message":{"content":"message body"}}]}',
                'data: [DONE]',
                '',
              ].join('\n')
            )
          );
          controller.close();
        },
      }),
    }));

    const { requestManagedChatCompletionStream } = await import('./managedService');
    const chunks: string[] = [];
    const content = await requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      (chunk) => chunks.push(chunk)
    );

    expect(content).toBe('message body');
    expect(chunks).toEqual(['message body']);
  });

  it('sanitizes managed web stream error payloads', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"error":{"message":"Model is not available for this user","code":"points_exhausted"}}\n\n')
          );
          controller.close();
        },
      }),
    }));

    const { requestManagedChatCompletionStream } = await import('./managedService');

    await expect(requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      vi.fn()
    )).rejects.toThrow('MANAGED_QUOTA_EXHAUSTED');
  });

  it('passes abort signals through managed web streams', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const controller = new AbortController();
    const fetchMock = vi.fn((_url, init) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { requestManagedChatCompletionStream } = await import('./managedService');
    const request = requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      vi.fn(),
      controller.signal,
    );
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('passes the managed diagnostic request id into the desktop stream bridge', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true);
    managedChatCompletionStreamMock.mockResolvedValue('ok');

    const { requestManagedChatCompletionStream } = await import('./managedService');

    await requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user' }],
        stream: true,
      },
      vi.fn()
    );

    expect(managedChatCompletionStreamMock).toHaveBeenCalledTimes(1);
    expect(managedChatCompletionStreamMock.mock.calls[0]?.[0]).toMatchObject({
      messages: [{ role: 'user', content: '' }],
    });
    expect(typeof managedChatCompletionStreamMock.mock.calls[0]?.[3]).toBe('string');
    expect(managedChatCompletionStreamMock.mock.calls[0]?.[3]).toContain('managed-stream-');
  });
});
