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
    });
  });
});
