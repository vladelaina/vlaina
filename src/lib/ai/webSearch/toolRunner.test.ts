import { describe, expect, it, vi } from 'vitest';
import { WEB_SEARCH_TOOL_NAMES } from './toolDefinitions';
import { runWebSearchToolCall } from './toolRunner';
import type { WebSearchClient } from './client';
import { MAX_OPENAI_TOOL_ARGUMENT_CHARS } from './openAIToolParsing';

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
      { name: 'search_web', arguments: JSON.stringify({ query: 'pytorch' }) },
      { client },
    );
    const pageText = await runWebSearchToolCall(
      { name: 'fetchUrl', arguments: JSON.stringify({ url: 'https://example.com/page' }) },
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

  it('auto-reads the first unique search URLs without scanning unneeded results', async () => {
    const unneededResult = {
      title: 'Unneeded',
      snippet: 'Snippet',
      publishedAt: null,
      source: null,
      thumbnail: null,
    } as { title: string; url: string; snippet: string; publishedAt: null; source: null; thumbnail: null };
    Object.defineProperty(unneededResult, 'url', {
      get() {
        throw new Error('unneeded result URL was read');
      },
    });
    const client: WebSearchClient = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [
          {
            title: 'One',
            url: 'https://one.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'One duplicate',
            url: 'https://one.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Two',
            url: 'https://two.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Three',
            url: 'https://three.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Four',
            url: 'https://four.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          unneededResult,
        ],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async (urls: string[]) => urls.map((url) => ({
        url,
        ok: true,
        page: {
          title: url,
          summary: '',
          siteName: new URL(url).hostname,
          finalUrl: url,
          content: 'Readable page content.',
          charCount: 22,
        },
      }))),
    };

    await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'sample app' }),
      },
      { client, autoReadAfterSearch: true },
    );

    expect(client.readWebPages).toHaveBeenCalledWith([
      'https://one.example',
      'https://two.example',
      'https://three.example',
    ], {
      contentLimit: 3000,
      retries: 0,
    });
  });

  it('accepts model-emitted aliases for batch page reads', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://example.com/a',
        ok: true,
        page: {
          title: 'A',
          summary: '',
          siteName: 'example.com',
          finalUrl: 'https://example.com/a',
          content: 'Readable A',
          charCount: 10,
        },
      }]),
    };

    const text = await runWebSearchToolCall(
      { name: 'fetch_web_pages', arguments: JSON.stringify({ urls: ['https://example.com/a'] }) },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(client.readWebPages).toHaveBeenCalledWith(['https://example.com/a'], {
      contentLimit: 3000,
      retries: 0,
    });
    expect(statuses).toEqual([
      { phase: 'reading', urls: ['https://example.com/a'] },
      {
        phase: 'complete',
        urls: ['https://example.com/a'],
        failedSources: [],
        metrics: {
          durationMs: expect.any(Number),
          failureCount: 0,
          successCount: 1,
        },
      },
    ]);
    expect(text).toContain('Readable A');
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

  it('reports safe read failure reasons without leaking raw errors', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(async () => {
        throw Object.assign(new Error('internal policy stack'), { code: 'blocked_source' });
      }),
      readWebPages: vi.fn(),
    };

    const text = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.read,
        arguments: JSON.stringify({ url: 'https://news.qq.com/rain/a/20260509A029BH00?adChannelId=news' }),
      },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(text).toBe('Tool error: This source is blocked by the web search source policy. The source was skipped.');
    expect(statuses).toEqual([
      { phase: 'reading', urls: ['https://news.qq.com/rain/a/20260509A029BH00?adChannelId=news'] },
      { phase: 'error', message: 'This source is blocked by the web search source policy. The source was skipped.' },
    ]);
    expect(text).not.toContain('internal policy stack');
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
          code: 'http_error',
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
          message: 'The page returned an HTTP error.',
        }],
        metrics: {
          durationMs: expect.any(Number),
          failureCount: 1,
          successCount: 1,
        },
      },
    ]);
    expect(text).toContain('The page returned an HTTP error.');
    expect(text).not.toContain('HTTP 500 from provider');
  });

  it('passes cancellation signals through to the web search client', async () => {
    const controller = new AbortController();
    const client: WebSearchClient = {
      webSearch: vi.fn(async (_query, _options, signal) => {
        expect(signal).toBe(controller.signal);
        return { query: 'openai', results: [] };
      }),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'openai' }),
      },
      { client, signal: controller.signal },
    );

    expect(client.webSearch).toHaveBeenCalledTimes(1);
  });

  it('does not swallow abort errors as normal tool failures', async () => {
    const controller = new AbortController();
    const client: WebSearchClient = {
      webSearch: vi.fn(async () => {
        controller.abort();
        throw new DOMException('cancelled', 'AbortError');
      }),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    await expect(runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'openai' }),
      },
      { client, signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('stops before calling the search client when a status callback cancels the request', async () => {
    const controller = new AbortController();
    const client: WebSearchClient = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    await expect(runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'openai' }),
      },
      {
        client,
        signal: controller.signal,
        onStatus: () => controller.abort(),
      },
    )).rejects.toMatchObject({ name: 'AbortError' });

    expect(client.webSearch).not.toHaveBeenCalled();
  });

  it('treats downstream abort-shaped failures as tool failures when the chat is still active', async () => {
    const controller = new AbortController();
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(async () => {
        throw new DOMException('provider internal timeout', 'AbortError');
      }),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const text = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'openai' }),
      },
      { client, signal: controller.signal, onStatus: (status) => statuses.push(status) },
    );

    expect(controller.signal.aborted).toBe(false);
    expect(text).toBe('Tool error: Web search is temporarily unavailable.');
    expect(statuses).toEqual([
      { phase: 'searching', query: 'openai' },
      { phase: 'error', message: 'Web search is temporarily unavailable.' },
    ]);
  });

  it('rejects oversized tool arguments before calling the web search client', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const text = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: 'x'.repeat(MAX_OPENAI_TOOL_ARGUMENT_CHARS + 1),
      },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(text).toBe('Tool error: Tool call arguments were invalid.');
    expect(statuses).toEqual([
      { phase: 'error', message: 'Tool call arguments were invalid.' },
    ]);
    expect(client.webSearch).not.toHaveBeenCalled();
    expect(client.readWebPage).not.toHaveBeenCalled();
    expect(client.readWebPages).not.toHaveBeenCalled();
  });

  it('rejects oversized query and URL values before calling the web search client', async () => {
    const statuses: unknown[] = [];
    const client: WebSearchClient = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const searchText = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.search,
        arguments: JSON.stringify({ query: 'x'.repeat(1001) }),
      },
      { client, onStatus: (status) => statuses.push(status) },
    );
    const readText = await runWebSearchToolCall(
      {
        name: WEB_SEARCH_TOOL_NAMES.read,
        arguments: JSON.stringify({ url: 'https://example.com/'.padEnd(16 * 1024 + 1, 'x') }),
      },
      { client, onStatus: (status) => statuses.push(status) },
    );

    expect(searchText).toBe('Tool error: Tool call arguments were invalid.');
    expect(readText).toBe('Tool error: Tool call arguments were invalid.');
    expect(statuses).toEqual([
      { phase: 'error', message: 'Tool call arguments were invalid.' },
      { phase: 'error', message: 'Tool call arguments were invalid.' },
    ]);
    expect(client.webSearch).not.toHaveBeenCalled();
    expect(client.readWebPage).not.toHaveBeenCalled();
    expect(client.readWebPages).not.toHaveBeenCalled();
  });
});
