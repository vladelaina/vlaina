import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  hasElectronDesktopBridgeMock,
  clearClientSessionMock,
  getManagedModelsMock,
  managedChatCompletionStreamMock,
} = vi.hoisted(() => ({
  hasElectronDesktopBridgeMock: vi.fn(),
  clearClientSessionMock: vi.fn(),
  getManagedModelsMock: vi.fn(),
  managedChatCompletionStreamMock: vi.fn(),
}));

vi.mock('@/lib/desktop/backend', () => ({
  hasElectronDesktopBridge: hasElectronDesktopBridgeMock,
}));

vi.mock('@/lib/account/desktopCommands', () => ({
  accountCommands: {
    getManagedModels: getManagedModelsMock,
    getManagedBudget: vi.fn(),
    managedChatCompletion: vi.fn(),
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

  it('clears client session when managed web auth is rejected', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchManagedModels, MANAGED_AUTH_REQUIRED_ERROR } = await import('./managedService');

    await expect(fetchManagedModels()).rejects.toThrow(MANAGED_AUTH_REQUIRED_ERROR);
    expect(clearClientSessionMock).toHaveBeenCalledTimes(1);
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
      body: JSON.stringify({
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      }),
    });
  });

  it('passes the managed diagnostic request id into the desktop stream bridge', async () => {
    hasElectronDesktopBridgeMock.mockReturnValue(true);
    managedChatCompletionStreamMock.mockResolvedValue('ok');

    const { requestManagedChatCompletionStream } = await import('./managedService');

    await requestManagedChatCompletionStream(
      {
        model: 'gpt-5.4',
        messages: [{ role: 'user', content: 'hello' }],
        stream: true,
      },
      vi.fn()
    );

    expect(managedChatCompletionStreamMock).toHaveBeenCalledTimes(1);
    expect(typeof managedChatCompletionStreamMock.mock.calls[0]?.[3]).toBe('string');
    expect(managedChatCompletionStreamMock.mock.calls[0]?.[3]).toContain('managed-stream-');
  });
});
