import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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
  getElectronBridge: () => mocks.bridge,
}));

import { providerFetch } from './providerHttp';

describe('providerFetch', () => {
  beforeEach(() => {
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
});
