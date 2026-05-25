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
});
