import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bridgeValue: null as null | {
    aiProvider: {
      startRequest: ReturnType<typeof vi.fn>;
      cancelRequest: ReturnType<typeof vi.fn>;
      onRequestChunk: ReturnType<typeof vi.fn>;
      onRequestDone: ReturnType<typeof vi.fn>;
      onRequestError: ReturnType<typeof vi.fn>;
    };
  },
  bridge: {
    aiProvider: {
      startRequest: vi.fn(),
      cancelRequest: vi.fn(async () => undefined),
      onRequestChunk: vi.fn((_requestId: string, _callback: (chunk: number[]) => void) => vi.fn()),
      onRequestDone: vi.fn((_requestId: string, _callback: () => void) => vi.fn()),
      onRequestError: vi.fn((_requestId: string, _callback: (payload: { message: string }) => void) => vi.fn()),
    },
  },
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => mocks.bridgeValue,
}));

import { providerFetch } from './providerHttp';

const MAX_DESKTOP_PROVIDER_BODY_BYTES = 64 * 1024 * 1024;
const MAX_DESKTOP_PROVIDER_RESPONSE_BYTES = 64 * 1024 * 1024;

describe('providerFetch', () => {
  beforeEach(() => {
    mocks.bridgeValue = mocks.bridge;
    mocks.bridge.aiProvider.startRequest.mockReset();
    mocks.bridge.aiProvider.cancelRequest.mockClear();
    mocks.bridge.aiProvider.onRequestChunk.mockClear();
    mocks.bridge.aiProvider.onRequestDone.mockClear();
    mocks.bridge.aiProvider.onRequestError.mockClear();
  });

  it('rejects promptly when a desktop provider request is aborted before metadata returns', async () => {
    const controller = new AbortController();
    mocks.bridge.aiProvider.startRequest.mockImplementation(
      () => new Promise(() => undefined),
    );

    const request = providerFetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.bridge.aiProvider.cancelRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects ambiguous desktop provider request URLs before reaching the bridge', async () => {
    await expect(providerFetch('https:api.example.com/v1/models', {
      method: 'GET',
    })).rejects.toThrow('AI provider request URL is not supported.');

    expect(mocks.bridge.aiProvider.startRequest).not.toHaveBeenCalled();
  });

  it('does not return desktop provider metadata after signal cancellation', async () => {
    const controller = new AbortController();
    mocks.bridge.aiProvider.startRequest.mockImplementationOnce(async () => {
      controller.abort();
      return {
        status: 200,
        statusText: 'OK',
        headers: [],
      };
    });

    const request = providerFetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
    });

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.bridge.aiProvider.cancelRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects and cleans up when desktop provider listener registration fails', async () => {
    const cleanupChunk = vi.fn();
    mocks.bridge.aiProvider.onRequestChunk.mockImplementationOnce(() => cleanupChunk);
    mocks.bridge.aiProvider.onRequestDone.mockImplementationOnce(() => {
      throw new Error('listener registration failed');
    });

    await expect(providerFetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
    })).rejects.toThrow('listener registration failed');

    expect(cleanupChunk).toHaveBeenCalledTimes(1);
    expect(mocks.bridge.aiProvider.startRequest).not.toHaveBeenCalled();
  });

  it('passes desktop provider Blob request bodies as base64 when Blob.arrayBuffer is unavailable', async () => {
    const blob = new Blob(['multipart-body']);
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: undefined,
    });
    mocks.bridge.aiProvider.startRequest.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: [],
    });

    const response = await providerFetch('https://api.example.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
      body: blob,
    });

    expect(response.status).toBe(200);
    expect(mocks.bridge.aiProvider.startRequest).toHaveBeenCalledWith(
      expect.any(String),
      {
        url: 'https://api.example.com/v1/images/edits',
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
        bodyBase64: 'bXVsdGlwYXJ0LWJvZHk=',
      },
    );
  });

  it('rejects oversized desktop provider Blob bodies before reading them', async () => {
    const blob = new Blob(['x']);
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(1));
    Object.defineProperty(blob, 'size', {
      configurable: true,
      value: MAX_DESKTOP_PROVIDER_BODY_BYTES + 1,
    });
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: arrayBuffer,
    });

    await expect(providerFetch('https://api.example.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
      body: blob,
    })).rejects.toThrow('Desktop AI provider request body is too large.');

    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(mocks.bridge.aiProvider.startRequest).not.toHaveBeenCalled();
  });

  it('rejects promptly when desktop provider Blob body serialization is aborted', async () => {
    const controller = new AbortController();
    const blob = new Blob(['multipart-body']);
    Object.defineProperty(blob, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(() => new Promise(() => undefined)),
    });

    const request = providerFetch('https://api.example.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
      body: blob,
      signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(mocks.bridge.aiProvider.startRequest).not.toHaveBeenCalled();
    expect(mocks.bridge.aiProvider.cancelRequest).toHaveBeenCalledTimes(1);
  });

  it('retries quickly failed web GET provider requests once', async () => {
    vi.useFakeTimers();
    try {
      mocks.bridgeValue = null;
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      const request = providerFetch('https://api.example.com/v1/models', {
        method: 'GET',
      });

      await vi.advanceTimersByTimeAsync(300);

      await expect(request).resolves.toMatchObject({ status: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects unsafe web provider request URLs before fetch', async () => {
    mocks.bridgeValue = null;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(providerFetch('http:/api.example.com/v1/models', {
      method: 'GET',
    })).rejects.toThrow('AI provider request URL is not supported.');
    await expect(providerFetch('https://user:pass@api.example.com/v1/models', {
      method: 'GET',
    })).rejects.toThrow('AI provider request URL is not supported.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries abort-shaped web GET failures when the caller did not cancel', async () => {
    vi.useFakeTimers();
    try {
      mocks.bridgeValue = null;
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('upstream reset', 'AbortError'))
        .mockResolvedValueOnce(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      const request = providerFetch('https://api.example.com/v1/models', {
        method: 'GET',
      });

      await vi.advanceTimersByTimeAsync(300);

      await expect(request).resolves.toMatchObject({ status: 200 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry web GET requests after the caller cancels', async () => {
    mocks.bridgeValue = null;
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(providerFetch('https://api.example.com/v1/models', {
      method: 'GET',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not return web provider responses after signal cancellation', async () => {
    mocks.bridgeValue = null;
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(providerFetch('https://api.example.com/v1/models', {
      method: 'GET',
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects web provider requests promptly when fetch ignores cancellation', async () => {
    mocks.bridgeValue = null;
    const controller = new AbortController();
    const fetchMock = vi.fn(() => new Promise(() => undefined));
    vi.stubGlobal('fetch', fetchMock);

    const request = providerFetch('https://api.example.com/v1/models', {
      method: 'GET',
      signal: controller.signal,
    });
    request.catch(() => undefined);

    await Promise.resolve();
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry web POST provider requests', async () => {
    mocks.bridgeValue = null;
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(providerFetch('https://api.example.com/v1/images/generations', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
    })).rejects.toThrow('fetch failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects promptly when desktop provider stream errors before metadata returns', async () => {
    const sendErrorRef: { current: ((payload: { message: string }) => void) | null } = { current: null };
    const cleanupChunk = vi.fn();
    const cleanupDone = vi.fn();
    const cleanupError = vi.fn();
    mocks.bridge.aiProvider.startRequest.mockImplementation(
      () => new Promise(() => undefined),
    );
    mocks.bridge.aiProvider.onRequestChunk.mockImplementationOnce(() => cleanupChunk);
    mocks.bridge.aiProvider.onRequestDone.mockImplementationOnce(() => cleanupDone);
    mocks.bridge.aiProvider.onRequestError.mockImplementationOnce((_requestId, callback) => {
      sendErrorRef.current = callback;
      return cleanupError;
    });

    const request = providerFetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
    });
    sendErrorRef.current?.({ message: 'provider stream failed' });

    await expect(request).rejects.toThrow('provider stream failed');
    expect(cleanupChunk).toHaveBeenCalledTimes(1);
    expect(cleanupDone).toHaveBeenCalledTimes(1);
    expect(cleanupError).toHaveBeenCalledTimes(1);
    expect(mocks.bridge.aiProvider.cancelRequest).not.toHaveBeenCalled();
  });

  it('ignores desktop provider chunks that arrive after the request is aborted', async () => {
    const controller = new AbortController();
    const sendChunkRef: { current: ((chunk: number[]) => void) | null } = { current: null };
    const cleanupChunk = vi.fn();
    const cleanupDone = vi.fn();
    const cleanupError = vi.fn();
    mocks.bridge.aiProvider.startRequest.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: [],
    });
    mocks.bridge.aiProvider.onRequestChunk.mockImplementationOnce((_requestId, callback) => {
      sendChunkRef.current = callback;
      return cleanupChunk;
    });
    mocks.bridge.aiProvider.onRequestDone.mockImplementationOnce(() => cleanupDone);
    mocks.bridge.aiProvider.onRequestError.mockImplementationOnce(() => cleanupError);

    const response = await providerFetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
    });

    controller.abort();
    expect(() => sendChunkRef.current?.([65])).not.toThrow();
    await expect(response.text()).rejects.toMatchObject({ name: 'AbortError' });
    expect(cleanupChunk).toHaveBeenCalledTimes(1);
    expect(cleanupDone).toHaveBeenCalledTimes(1);
    expect(cleanupError).toHaveBeenCalledTimes(1);
    expect(mocks.bridge.aiProvider.cancelRequest).toHaveBeenCalledTimes(1);
  });

  it('cancels desktop provider streams when bridge response bytes exceed the limit', async () => {
    const sendChunkRef: { current: ((chunk: number[]) => void) | null } = { current: null };
    const cleanupChunk = vi.fn();
    const cleanupDone = vi.fn();
    const cleanupError = vi.fn();
    mocks.bridge.aiProvider.startRequest.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      headers: [],
    });
    mocks.bridge.aiProvider.onRequestChunk.mockImplementationOnce((_requestId, callback) => {
      sendChunkRef.current = callback;
      return cleanupChunk;
    });
    mocks.bridge.aiProvider.onRequestDone.mockImplementationOnce(() => cleanupDone);
    mocks.bridge.aiProvider.onRequestError.mockImplementationOnce(() => cleanupError);

    const response = await providerFetch('https://api.example.com/v1/chat/completions', {
      method: 'POST',
    });

    sendChunkRef.current?.(new Array(MAX_DESKTOP_PROVIDER_RESPONSE_BYTES + 1));

    await expect(response.text()).rejects.toThrow('Desktop AI provider response body is too large.');
    expect(cleanupChunk).toHaveBeenCalledTimes(1);
    expect(cleanupDone).toHaveBeenCalledTimes(1);
    expect(cleanupError).toHaveBeenCalledTimes(1);
    expect(mocks.bridge.aiProvider.cancelRequest).toHaveBeenCalledTimes(1);
  });
});
