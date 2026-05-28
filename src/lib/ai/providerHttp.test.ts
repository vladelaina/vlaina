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
      onRequestChunk: vi.fn(() => vi.fn()),
      onRequestDone: vi.fn(() => vi.fn()),
      onRequestError: vi.fn(() => vi.fn()),
    },
  },
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => mocks.bridgeValue,
}));

import { providerFetch } from './providerHttp';

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
});
