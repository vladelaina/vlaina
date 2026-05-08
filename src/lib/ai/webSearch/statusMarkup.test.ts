import { describe, expect, it } from 'vitest';
import { buildWebSearchStatusMarkup, extractWebSearchStatuses } from './statusMarkup';

describe('web search status markup', () => {
  it('round-trips status payloads and removes markup from content', () => {
    const markup = buildWebSearchStatusMarkup({
      phase: 'results',
      query: 'a < b & c',
      results: [{ title: 'Title', url: 'https://example.com', snippet: 'Summary', publishedAt: null }],
    });

    const parsed = extractWebSearchStatuses(`${markup}\n\nAnswer`);

    expect(parsed.statuses).toEqual([
      {
        phase: 'results',
        query: 'a < b & c',
        results: [{ title: 'Title', url: 'https://example.com', snippet: 'Summary', publishedAt: null }],
      },
    ]);
    expect(parsed.content).toBe('Answer');
  });

  it('drops malformed or unsafe status payload fields', () => {
    const markup = buildWebSearchStatusMarkup({
      phase: 'results',
      query: 'safe',
      urls: ['javascript:alert(1)', 'https://example.com/read'],
      results: [
        { title: 'Unsafe', url: 'javascript:alert(1)', snippet: 'Bad', publishedAt: null },
        { title: 'Safe', url: 'https://example.com', snippet: 'Good', publishedAt: null },
      ],
      failedSources: [
        { url: 'data:text/html,hello', message: 'Bad' },
        { url: 'https://example.com/fail', message: 'Skipped' },
      ],
      metrics: { durationMs: 12.6 },
    });
    const invalidMarkup = '<web-search-status>{"phase":"invalid","urls":["https://example.com"]}</web-search-status>';

    const parsed = extractWebSearchStatuses(`${markup}${invalidMarkup}Answer`);

    expect(parsed.statuses).toEqual([
      {
        phase: 'results',
        query: 'safe',
        urls: ['https://example.com/read'],
        results: [{ title: 'Safe', url: 'https://example.com', snippet: 'Good', publishedAt: null }],
        failedSources: [{ url: 'https://example.com/fail', message: 'Skipped' }],
        metrics: { durationMs: 13 },
      },
    ]);
    expect(parsed.content).toBe('Answer');
  });
});
