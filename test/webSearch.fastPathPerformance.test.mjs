import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { SearchService } from '../electron/webSearch/searchService.mjs';

const fastPathQueries = [
  'where do I renew my US passport online official',
  'how can I check my IRS refund status official',
  'how do I check if my car has a recall official',
  'what ID can I use at the airport TSA official',
  'what to do if I paid a scammer with gift card official',
  'adult vaccine schedule official CDC',
  'apply for FEMA disaster assistance official',
  'patent search official USPTO',
  'clinical trials official NIH',
  'PubMed official search',
];

describe('web search fast path performance', () => {
  it('keeps common official-source queries on a low-latency zero-network path', async () => {
    const service = new SearchService({
      providers: [new LocalSearchProvider({
        fetchImpl: async () => {
          throw new Error('external search should not be called for fast path performance');
        },
      })],
    });
    const timings = [];

    for (const query of fastPathQueries) {
      const startedAt = performance.now();
      const response = await service.webSearch(query, { limit: 5 });
      timings.push(performance.now() - startedAt);

      expect(response.results.length, query).toBeGreaterThan(0);
    }

    const warmTimings = timings.slice(1).sort((left, right) => left - right);
    const medianMs = warmTimings[Math.floor(warmTimings.length / 2)];
    const p90Ms = warmTimings[Math.floor(warmTimings.length * 0.9)];
    const maxWarmMs = Math.max(...warmTimings);

    expect(medianMs).toBeLessThan(15);
    expect(p90Ms).toBeLessThan(75);
    expect(maxWarmMs).toBeLessThan(150);
  });
});
