import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bridge: {
    webSearch: {
      search: vi.fn(),
      read: vi.fn(),
      readBatch: vi.fn(),
      cancelRequest: vi.fn(async () => true),
    },
  },
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => mocks.bridge,
}));

import { createWebSearchClient } from './client';

describe('web search client', () => {
  beforeEach(() => {
    mocks.bridge.webSearch.search.mockReset();
    mocks.bridge.webSearch.read.mockReset();
    mocks.bridge.webSearch.readBatch.mockReset();
    mocks.bridge.webSearch.cancelRequest.mockClear();
  });

  it('passes a cancellable request id to the desktop bridge and cancels it on abort', async () => {
    const controller = new AbortController();
    mocks.bridge.webSearch.search.mockImplementation(
      () => new Promise(() => undefined),
    );

    const request = createWebSearchClient().webSearch('latest openai news', { limit: 5 }, controller.signal);
    const requestId = mocks.bridge.webSearch.search.mock.calls[0][2];
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestId).toMatch(/^web-search-\d+-\d+$/);
    expect(mocks.bridge.webSearch.cancelRequest).toHaveBeenCalledWith(requestId);
  });

  it('cancels when the signal aborts while the desktop bridge request is starting', async () => {
    const controller = new AbortController();
    mocks.bridge.webSearch.search.mockImplementation(() => {
      controller.abort();
      return new Promise(() => undefined);
    });

    const request = createWebSearchClient().webSearch('latest openai news', { limit: 5 }, controller.signal);

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    const requestId = mocks.bridge.webSearch.search.mock.calls[0][2];
    expect(requestId).toMatch(/^web-search-\d+-\d+$/);
    expect(mocks.bridge.webSearch.cancelRequest).toHaveBeenCalledWith(requestId);
  });

  it('does not return desktop search results after signal cancellation', async () => {
    const controller = new AbortController();
    mocks.bridge.webSearch.search.mockImplementation(async () => {
      controller.abort();
      return { query: 'openai', results: [{ title: 'late', url: 'https://example.com' }] };
    });

    const request = createWebSearchClient().webSearch('latest openai news', { limit: 5 }, controller.signal);

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    const requestId = mocks.bridge.webSearch.search.mock.calls[0][2];
    expect(requestId).toMatch(/^web-search-\d+-\d+$/);
    expect(mocks.bridge.webSearch.cancelRequest).toHaveBeenCalledWith(requestId);
  });

  it('cancels desktop batch reads through their request id', async () => {
    const controller = new AbortController();
    mocks.bridge.webSearch.readBatch.mockImplementation(
      () => new Promise(() => undefined),
    );

    const request = createWebSearchClient().readWebPages(
      ['https://example.com/a', 'https://example.com/b'],
      { contentLimit: 3000 },
      controller.signal,
    );
    const requestId = mocks.bridge.webSearch.readBatch.mock.calls[0][2];
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestId).toMatch(/^web-search-\d+-\d+$/);
    expect(mocks.bridge.webSearch.cancelRequest).toHaveBeenCalledWith(requestId);
  });

  it('does not allocate a desktop cancel request id without an AbortSignal', async () => {
    mocks.bridge.webSearch.search.mockResolvedValue({ query: 'openai', results: [] });

    await expect(createWebSearchClient().webSearch('openai', { limit: 5 })).resolves.toEqual({
      query: 'openai',
      results: [],
    });

    expect(mocks.bridge.webSearch.search).toHaveBeenCalledWith('openai', { limit: 5 }, undefined);
    expect(mocks.bridge.webSearch.cancelRequest).not.toHaveBeenCalled();
  });
});
