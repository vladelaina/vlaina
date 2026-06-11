import { describe, expect, it, vi } from 'vitest';
import { registerWebSearchIpc } from '../electron/webSearch/ipc.mjs';

function collectHandlers() {
  const handlers = new Map();
  const services = {
    searchService: {
      webSearch: vi.fn(async () => ({ query: 'catime', results: [] })),
    },
    crawler: {
      readUrl: vi.fn(),
    },
  };
  registerWebSearchIpc({
    handleIpc: (channel, handler) => {
      handlers.set(channel, handler);
    },
    services,
  });
  return { handlers, services };
}

describe('web search IPC', () => {
  it('does not accept provider or engine configuration from the renderer', async () => {
    const { handlers, services } = collectHandlers();
    const searchHandler = handlers.get('desktop:web-search:search');

    await searchHandler(null, 'catime', {
      category: 'general',
      timeRange: 'week',
      engines: ['baidu'],
      provider: 'searxng',
      apiKey: 'secret',
      baseUrl: 'https://attacker.example',
      limit: 5,
    });

    expect(services.searchService.webSearch).toHaveBeenCalledWith('catime', {
      category: 'general',
      timeRange: 'week',
      limit: 5,
      signal: undefined,
    });
  });

  it('bounds search IPC inputs before invoking the search service', async () => {
    const { handlers, services } = collectHandlers();
    const searchHandler = handlers.get('desktop:web-search:search');

    await searchHandler(null, '  catime  ', {
      category: ' news ',
      timeRange: 'x'.repeat(65),
      limit: '5',
    });

    expect(services.searchService.webSearch).toHaveBeenCalledWith('catime', {
      category: 'news',
      timeRange: undefined,
      limit: 5,
      signal: undefined,
    });

    await expect(searchHandler(null, 'x'.repeat(1001), { limit: 5 })).rejects.toMatchObject({
      code: 'invalid_query',
    });
    expect(services.searchService.webSearch).toHaveBeenCalledTimes(1);
  });

  it('bounds read IPC inputs before invoking the crawler', async () => {
    const { handlers, services } = collectHandlers();
    services.crawler.readUrl.mockResolvedValue({
      title: 'Example',
      summary: '',
      siteName: 'example.com',
      finalUrl: 'https://example.com',
      content: 'content',
      charCount: 7,
    });

    const readBatchHandler = handlers.get('desktop:web-search:read-batch');
    await readBatchHandler(
      null,
      [
        ' https://example.com/one ',
        'https://example.com/two',
        ...Array.from({ length: 10 }, (_, index) => `https://example.com/extra-${index}`),
      ],
      { retries: '1', contentLimit: '3000' },
    );

    expect(services.crawler.readUrl).toHaveBeenCalledTimes(8);
    expect(services.crawler.readUrl).toHaveBeenNthCalledWith(1, 'https://example.com/one', expect.objectContaining({
      retries: 1,
      contentLimit: 3000,
    }));

    await expect(readBatchHandler(null, ['https://example.com/'.padEnd(4097, 'x')], {})).rejects.toMatchObject({
      code: 'invalid_url',
    });
    expect(services.crawler.readUrl).toHaveBeenCalledTimes(8);
  });

  it('cancels an in-flight search request by request id', async () => {
    const handlers = new Map();
    const services = {
      searchService: {
        webSearch: vi.fn((_query, options) => new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('cancelled', 'AbortError'));
          }, { once: true });
        })),
      },
      crawler: {
        readUrl: vi.fn(),
      },
    };
    registerWebSearchIpc({
      handleIpc: (channel, handler) => {
        handlers.set(channel, handler);
      },
      services,
    });

    const searchPromise = handlers.get('desktop:web-search:search')(null, 'catime', { limit: 5 }, 'request-1');
    await expect(handlers.get('desktop:web-search:cancel')(null, 'request-1')).resolves.toBe(true);
    await expect(searchPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects a search result that resolves after the request was cancelled', async () => {
    const handlers = new Map();
    const services = {
      searchService: {
        webSearch: vi.fn((_query, options) => new Promise((resolve) => {
          options.signal.addEventListener('abort', () => {
            resolve({ query: 'catime', results: [] });
          }, { once: true });
        })),
      },
      crawler: {
        readUrl: vi.fn(),
      },
    };
    registerWebSearchIpc({
      handleIpc: (channel, handler) => {
        handlers.set(channel, handler);
      },
      services,
    });

    const searchPromise = handlers.get('desktop:web-search:search')(null, 'catime', { limit: 5 }, 'request-stale-search');
    await expect(handlers.get('desktop:web-search:cancel')(null, 'request-stale-search')).resolves.toBe(true);

    await expect(searchPromise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('passes cancellation signals into page reads', async () => {
    const handlers = new Map();
    const services = {
      searchService: {
        webSearch: vi.fn(),
      },
      crawler: {
        readUrl: vi.fn((_url, options) => new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('cancelled', 'AbortError'));
          }, { once: true });
        })),
      },
    };
    registerWebSearchIpc({
      handleIpc: (channel, handler) => {
        handlers.set(channel, handler);
      },
      services,
    });

    const readPromise = handlers.get('desktop:web-search:read-batch')(null, ['https://example.com'], { retries: 0 }, 'request-2');
    await expect(handlers.get('desktop:web-search:cancel')(null, 'request-2')).resolves.toBe(true);
    await expect(readPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(services.crawler.readUrl).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
  });

  it('rejects page read results that resolve after cancellation', async () => {
    const handlers = new Map();
    const services = {
      searchService: {
        webSearch: vi.fn(),
      },
      crawler: {
        readUrl: vi.fn((_url, options) => new Promise((resolve) => {
          options.signal.addEventListener('abort', () => {
            resolve({
              title: 'Example',
              url: 'https://example.com',
              summary: '',
              content: 'late content',
            });
          }, { once: true });
        })),
      },
    };
    registerWebSearchIpc({
      handleIpc: (channel, handler) => {
        handlers.set(channel, handler);
      },
      services,
    });

    const readPromise = handlers.get('desktop:web-search:read-batch')(
      null,
      ['https://example.com'],
      { retries: 0 },
      'request-stale-read',
    );
    await expect(handlers.get('desktop:web-search:cancel')(null, 'request-stale-read')).resolves.toBe(true);

    await expect(readPromise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
