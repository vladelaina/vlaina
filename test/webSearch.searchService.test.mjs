import { describe, expect, it, vi } from 'vitest';
import { SearchService } from '../electron/webSearch/searchService.mjs';

describe('SearchService', () => {
  it('falls back from full options to plain keyword search', async () => {
    const provider = {
      isConfigured: () => true,
      search: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            title: 'Result',
            url: 'https://example.com',
            snippet: '',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
        ]),
    };
    const service = new SearchService({ providers: [provider] });

    const response = await service.webSearch('query', {
      category: 'news',
      timeRange: 'week',
      engines: 'google',
    });

    expect(response.results).toHaveLength(1);
    expect(provider.search).toHaveBeenNthCalledWith(1, 'query', {
      category: 'news',
      timeRange: 'week',
      engines: 'google',
      limit: 5,
      signal: expect.any(AbortSignal),
    });
    expect(provider.search).toHaveBeenNthCalledWith(2, 'query', {
      category: 'news',
      timeRange: 'week',
      engines: undefined,
      limit: 5,
      signal: expect.any(AbortSignal),
    });
    expect(provider.search).toHaveBeenNthCalledWith(3, 'query', {
      limit: 5,
      signal: expect.any(AbortSignal),
    });
  });

  it('runs fallback attempts concurrently to avoid stacked search timeouts', async () => {
    const resolvers = [];
    const provider = {
      isConfigured: () => true,
      search: vi.fn((_query, attempt) => new Promise((resolve) => {
        resolvers.push({ attempt, resolve });
      })),
    };
    const service = new SearchService({ providers: [provider], fallbackResultGraceMs: 0 });

    const responsePromise = service.webSearch('query', {
      category: 'news',
      timeRange: 'week',
    });

    expect(provider.search).toHaveBeenCalledTimes(2);
    resolvers[1].resolve([
      {
        title: 'Plain Result',
        url: 'https://example.com/plain',
        snippet: '',
        publishedAt: null,
        source: null,
        thumbnail: null,
      },
    ]);

    await expect(responsePromise).resolves.toEqual({
      query: 'query',
      results: [expect.objectContaining({ title: 'Plain Result' })],
    });
  });

  it('prefers a higher-priority constrained attempt when it finishes during the fallback grace window', async () => {
    const resolvers = [];
    const provider = {
      isConfigured: () => true,
      search: vi.fn((_query, attempt) => new Promise((resolve) => {
        resolvers.push({ attempt, resolve });
      })),
    };
    const service = new SearchService({ providers: [provider], fallbackResultGraceMs: 50 });

    const responsePromise = service.webSearch('query', {
      category: 'news',
      timeRange: 'week',
    });

    expect(provider.search).toHaveBeenCalledTimes(2);
    resolvers[1].resolve([
      {
        title: 'Plain Result',
        url: 'https://example.com/plain',
        snippet: '',
        publishedAt: null,
        source: null,
        thumbnail: null,
      },
    ]);
    await Promise.resolve();
    resolvers[0].resolve([
      {
        title: 'Fresh News Result',
        url: 'https://example.com/news',
        snippet: '',
        publishedAt: null,
        source: null,
        thumbnail: null,
      },
    ]);

    await expect(responsePromise).resolves.toEqual({
      query: 'query',
      results: [expect.objectContaining({ title: 'Fresh News Result' })],
    });
  });

  it('returns ready fallback results after the grace window when constrained attempts stay pending', async () => {
    vi.useFakeTimers();
    try {
      const aborts = [];
      const resolvers = [];
      const provider = {
        isConfigured: () => true,
        search: vi.fn((_query, attempt) => {
          attempt.signal.addEventListener('abort', () => {
            aborts.push(attempt.category || 'plain');
          }, { once: true });
          return new Promise((resolve) => {
            resolvers.push({ attempt, resolve });
          });
        }),
      };
      const service = new SearchService({ providers: [provider], fallbackResultGraceMs: 25 });

      const responsePromise = service.webSearch('query', {
        category: 'news',
        timeRange: 'week',
      });
      let settled = false;
      void responsePromise.then(() => {
        settled = true;
      });

      expect(provider.search).toHaveBeenCalledTimes(2);
      resolvers[1].resolve([
        {
          title: 'Plain Result',
          url: 'https://example.com/plain',
          snippet: '',
          publishedAt: null,
          source: null,
          thumbnail: null,
        },
      ]);
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(24);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await expect(responsePromise).resolves.toEqual({
        query: 'query',
        results: [expect.objectContaining({ title: 'Plain Result' })],
      });
      expect(aborts).toEqual(['news']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels slower fallback attempts after one attempt returns results', async () => {
    const aborts = [];
    const provider = {
      isConfigured: () => true,
      search: vi.fn((_query, attempt) => {
        attempt.signal.addEventListener('abort', () => {
          aborts.push(attempt.category || 'plain');
        }, { once: true });
        if (attempt.category === 'news') {
          return new Promise(() => {});
        }
        return Promise.resolve([
          {
            title: 'Plain Result',
            url: 'https://example.com/plain',
            snippet: '',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
        ]);
      }),
    };
    const service = new SearchService({ providers: [provider], fallbackResultGraceMs: 0 });

    await expect(service.webSearch('query', {
      category: 'news',
      timeRange: 'week',
    })).resolves.toEqual({
      query: 'query',
      results: [expect.objectContaining({ title: 'Plain Result' })],
    });

    expect(provider.search).toHaveBeenCalledTimes(2);
    expect(aborts).toEqual(['news']);
  });

  it('rejects provider results that resolve after external cancellation', async () => {
    const controller = new AbortController();
    const provider = {
      isConfigured: () => true,
      search: vi.fn(async () => {
        controller.abort();
        return [
          {
            title: 'Late Result',
            url: 'https://example.com/late',
            snippet: '',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
        ];
      }),
    };
    const service = new SearchService({ providers: [provider] });

    await expect(service.webSearch('query', {
      limit: 5,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(provider.search).toHaveBeenCalledTimes(1);
  });

  it('does not repeat identical fallback attempts', async () => {
    const provider = {
      isConfigured: () => true,
      search: vi.fn().mockResolvedValue([]),
    };
    const service = new SearchService({ providers: [provider] });

    await service.webSearch('query', { limit: 5 });

    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(provider.search).toHaveBeenCalledWith('query', {
      limit: 5,
      signal: expect.any(AbortSignal),
    });
  });

  it('skips engine-only fallback when no engine restriction exists', async () => {
    const provider = {
      isConfigured: () => true,
      search: vi.fn().mockResolvedValue([]),
    };
    const service = new SearchService({ providers: [provider] });

    await service.webSearch('query', { category: 'news', timeRange: 'week' });

    expect(provider.search).toHaveBeenCalledTimes(2);
    expect(provider.search).toHaveBeenNthCalledWith(1, 'query', {
      category: 'news',
      timeRange: 'week',
      limit: 5,
      signal: expect.any(AbortSignal),
    });
    expect(provider.search).toHaveBeenNthCalledWith(2, 'query', {
      limit: 5,
      signal: expect.any(AbortSignal),
    });
  });

  it('throws unavailable when every provider attempt fails', async () => {
    const provider = {
      isConfigured: () => true,
      search: vi.fn().mockRejectedValue(Object.assign(new Error('network down'), { code: 'search_unavailable' })),
    };
    const service = new SearchService({ providers: [provider] });

    await expect(service.webSearch('query', { limit: 5 })).rejects.toMatchObject({
      code: 'search_unavailable',
      message: 'Web search is temporarily unavailable.',
    });
  });

  it('keeps empty search results distinct from provider failures', async () => {
    const provider = {
      isConfigured: () => true,
      search: vi.fn().mockResolvedValue([]),
    };
    const service = new SearchService({ providers: [provider] });

    await expect(service.webSearch('query', { limit: 5 })).resolves.toEqual({
      query: 'query',
      results: [],
    });
  });
});
