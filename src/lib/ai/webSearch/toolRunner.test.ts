import { describe, expect, it, vi } from 'vitest';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import { runWebSearchToolCall } from './toolRunner';
import type { WebSearchClient } from './client';

describe('web search tool runner', () => {
  it('runs search and emits search/result statuses', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(async () => ({
        query: 'openai news',
        results: [{
          title: 'News',
          url: 'https://example.com/news',
          snippet: 'Snippet',
          publishedAt: '2026-05-06',
          source: 'example',
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const text = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'openai news', category: 'news', timeRange: 'week' }),
      },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(client.webSearch).toHaveBeenCalledWith('openai news', {
      category: 'news',
      timeRange: 'week',
      limit: 5,
    });
    expect(statuses).toEqual([
      { phase: 'searching', query: 'openai news' },
      {
        phase: 'results',
        query: 'openai news',
        results: [{
          title: 'News',
          url: 'https://example.com/news',
          snippet: 'Snippet',
          publishedAt: '2026-05-06',
          source: 'example',
          thumbnail: null,
        }],
        metrics: {
          durationMs: expect.any(Number),
          resultCount: 1,
        },
        message: undefined,
      },
    ]);
    expect(text).toContain('Candidate sources');
    expect(text).toContain('https://example.com/news');
  });

  it('accepts model-emitted aliases for search and read tools', async () => {
    const client: WebSearchClient = {
      webSearch: vi.fn(async () => ({
        query: 'pytorch',
        results: [],
      })),
      readWebPage: vi.fn(async () => ({
        title: 'Page',
        summary: '',
        siteName: 'example.com',
        finalUrl: 'https://example.com/page',
        content: 'Readable content from the page.',
        charCount: 31,
      })),
      readWebPages: vi.fn(),
    };

    await runWebSearchToolCall(
      { name: 'search', arguments: JSON.stringify({ query: 'pytorch' }) },
      { client },
    );
    const pageText = await runWebSearchToolCall(
      { name: 'read_page', arguments: JSON.stringify({ url: 'https://example.com/page' }) },
      { client },
    );

    expect(client.webSearch).toHaveBeenCalledWith('pytorch', {
      category: undefined,
      timeRange: undefined,
      limit: 5,
    });
    expect(client.readWebPage).toHaveBeenCalledWith('https://example.com/page', {
      contentLimit: 3000,
      retries: 0,
    });
    expect(pageText).toContain('Readable content from the page.');
  });

  it('sanitizes tool errors before returning them to the model', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(async () => {
        throw new Error('INTERNAL_SEARCH_BACKEND_URL is missing');
      }),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const text = await runWebSearchToolCall(
      { name: WEB_SEARCH_TOOL_NAMES.search, arguments: JSON.stringify({ query: 'news' }) },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(text).toBe('Tool error: Web search is temporarily unavailable.');
    expect(statuses).toEqual([
      { phase: 'searching', query: 'news' },
      { phase: 'error', message: 'Web search is temporarily unavailable.' },
    ]);
    expect(text).not.toContain('INTERNAL_SEARCH_BACKEND_URL');
  });

  it('emits read metrics and safe skipped source details for batch reads', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [
        {
          url: 'https://ok.example',
          ok: true,
          page: {
            title: 'OK',
            summary: '',
            siteName: 'ok.example',
            finalUrl: 'https://ok.example',
            content: 'Readable content',
            charCount: 16,
          },
        },
        {
          url: 'https://fail.example',
          ok: false,
          error: 'HTTP 500 from provider',
        },
      ]),
    };

    const text = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.readBatch,
        arguments: JSON.stringify({ urls: ['https://ok.example', 'https://fail.example'] }),
      },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(statuses).toEqual([
      { phase: 'reading', urls: ['https://ok.example', 'https://fail.example'] },
      {
        phase: 'complete',
        urls: ['https://ok.example'],
        failedSources: [{
          url: 'https://fail.example',
          message: 'Unable to read this page.',
        }],
        metrics: {
          durationMs: expect.any(Number),
          failureCount: 1,
          successCount: 1,
        },
      },
    ]);
    expect(text).toContain('Unable to read this page.');
    expect(text).not.toContain('HTTP 500 from provider');
  });
});
