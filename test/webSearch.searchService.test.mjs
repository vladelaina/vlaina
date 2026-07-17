import { describe, expect, it, vi } from 'vitest';
import { SearchService, searchServiceInternals } from '../electron/webSearch/searchService.mjs';
import { WebSearchError } from '../electron/webSearch/types.mjs';

function provider(search) {
  return { isConfigured: () => true, search };
}

describe('SearchService', () => {
  it('runs constrained and fallback attempts sequentially', async () => {
    let active = 0;
    let maxActive = 0;
    const search = vi.fn(async (_query, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return options.timeRange ? [] : [{ url: 'https://example.com' }];
    });

    const result = await new SearchService({ providers: [provider(search)] }).webSearch('query', {
      timeRange: 'week',
      limit: 5,
    });

    expect(result.results).toHaveLength(1);
    expect(search).toHaveBeenNthCalledWith(1, 'query', expect.objectContaining({ timeRange: 'week' }));
    expect(search).toHaveBeenNthCalledWith(2, 'query', expect.not.objectContaining({ timeRange: 'week' }));
    expect(maxActive).toBe(1);
  });

  it('does not create duplicate fallback attempts', () => {
    expect(searchServiceInternals.buildSearchAttempts({ category: 'news' }, 5)).toEqual([
      { category: 'news', limit: 5 },
      { limit: 5 },
    ]);
  });

  it('tries providers sequentially', async () => {
    const first = vi.fn(async () => []);
    const second = vi.fn(async () => [{ url: 'https://example.com' }]);

    const result = await new SearchService({
      providers: [provider(first), provider(second)],
    }).webSearch('query');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.results).toHaveLength(1);
  });

  it('returns empty results when a provider completed successfully', async () => {
    const service = new SearchService({ providers: [provider(vi.fn(async () => []))] });
    await expect(service.webSearch('query')).resolves.toEqual({ query: 'query', results: [] });
  });

  it('throws unavailable when every provider attempt fails', async () => {
    const service = new SearchService({
      providers: [provider(vi.fn(async () => { throw new Error('upstream failed'); }))],
    });
    await expect(service.webSearch('query')).rejects.toMatchObject({ code: 'search_unavailable' });
  });

  it('propagates cancellation and invalid query errors', async () => {
    const controller = new AbortController();
    controller.abort();
    const service = new SearchService({ providers: [provider(vi.fn())] });

    await expect(service.webSearch('query', { signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' });
    await expect(service.webSearch('')).rejects.toBeInstanceOf(WebSearchError);
  });
});
