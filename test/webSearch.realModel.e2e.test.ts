import { describe, expect, it } from 'vitest';
import { runOpenAIWebSearchJsonToolLoop } from '../src/lib/ai/webSearch/openAIToolLoop';
import { SearchService } from '../electron/webSearch/searchService.mjs';
import { LocalSearchProvider } from '../electron/webSearch/localSearchProvider.mjs';
import { Crawler } from '../electron/webSearch/crawler.mjs';
import { readUrlsBatch } from '../electron/webSearch/batchCrawler.mjs';
import { DEFAULT_EXCLUDED_SITES } from '../electron/webSearch/searchQualityPolicy.mjs';
import type { ChatCompletionRequest } from '../src/lib/ai/types';
import type { WebSearchClient, WebSearchResponse } from '../src/lib/ai/webSearch/client';
import type { WebPageContent, WebPageReadResult } from '../src/lib/ai/webSearch/types';

const runRealModel = process.env.REAL_WEB_SEARCH_MODEL_E2E === '1';
const describeRealModel = runRealModel ? describe : describe.skip;

interface TraceEvent {
  type: string;
  detail: unknown;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for REAL_WEB_SEARCH_MODEL_E2E.`);
  }
  return value;
}

function redactBearer(value: string): string {
  return value ? '[redacted]' : '';
}

function expectProcessTrace(trace: TraceEvent[], expectedUrls: string[], expectBatchRead = false): void {
  expect(trace.some((event) => event.type === 'tool:web_search:start')).toBe(true);
  expect(trace.some((event) => event.type === 'tool:web_search:result')).toBe(true);
  expect(
    trace.some((event) =>
      event.type === 'tool:read_web_page:start' || event.type === 'tool:read_web_pages:start'
    )
  ).toBe(true);
  expect(
    trace.some((event) =>
      event.type === 'tool:read_web_page:result' || event.type === 'tool:read_web_pages:result'
    )
  ).toBe(true);
  expect(trace.some((event) =>
    event.type === 'status'
    && typeof event.detail === 'object'
    && event.detail !== null
    && (event.detail as { phase?: string }).phase === 'searching'
  )).toBe(true);
  expect(trace.some((event) =>
    event.type === 'status'
    && typeof event.detail === 'object'
    && event.detail !== null
    && (event.detail as { phase?: string }).phase === 'results'
  )).toBe(true);
  expect(trace.some((event) =>
    event.type === 'status'
    && typeof event.detail === 'object'
    && event.detail !== null
    && (event.detail as { phase?: string }).phase === 'reading'
  )).toBe(true);
  expect(trace.some((event) =>
    event.type === 'status'
    && typeof event.detail === 'object'
    && event.detail !== null
    && (event.detail as { phase?: string }).phase === 'complete'
  )).toBe(true);
  if (expectBatchRead) {
    expect(trace.some((event) => event.type === 'tool:read_web_pages:start')).toBe(true);
    expect(trace.some((event) => event.type === 'tool:read_web_pages:result')).toBe(true);
  }
  expect(trace.some((event) =>
    expectedUrls.every((expectedUrl) =>
      JSON.stringify(event.detail).toLowerCase().includes(expectedUrl.toLowerCase())
    )
  )).toBe(true);
}

function expectSearchResultsAvoidBlockedHosts(trace: TraceEvent[]): void {
  const blockedHosts = [...DEFAULT_EXCLUDED_SITES, 'bilibili.com/video', 'player.bilibili.com'];
  const resultEvents = trace.filter((event) => event.type === 'tool:web_search:result');
  expect(resultEvents.length).toBeGreaterThan(0);

  for (const event of resultEvents) {
    const urls = (event.detail as { urls?: unknown }).urls;
    expect(Array.isArray(urls)).toBe(true);
    for (const url of urls as string[]) {
      const lowerUrl = url.toLowerCase();
      expect(blockedHosts.some((host) => lowerUrl.includes(host))).toBe(false);
    }
  }
}

function createLocalWebSearchClient(trace: TraceEvent[]): WebSearchClient {
  const searchService = new SearchService({
    providers: [new LocalSearchProvider()],
  });
  const crawler = new Crawler();

  return {
    async webSearch(query, options): Promise<WebSearchResponse> {
      trace.push({ type: 'tool:web_search:start', detail: { query, options } });
      const response = await searchService.webSearch(query, options);
      trace.push({
        type: 'tool:web_search:result',
        detail: {
          query: response.query,
          urls: response.results.map((result) => result.url),
        },
      });
      return response;
    },
    async readWebPage(url, options): Promise<WebPageContent> {
      trace.push({ type: 'tool:read_web_page:start', detail: { url, options } });
      const page = await crawler.readUrl(url, options);
      trace.push({
        type: 'tool:read_web_page:result',
        detail: {
          finalUrl: page.finalUrl,
          title: page.title,
          siteName: page.siteName,
          charCount: page.charCount,
        },
      });
      return page;
    },
    async readWebPages(urls, options): Promise<WebPageReadResult[]> {
      trace.push({ type: 'tool:read_web_pages:start', detail: { urls, options } });
      const pages = await readUrlsBatch(crawler, urls, options);
      trace.push({
        type: 'tool:read_web_pages:result',
        detail: pages.map((page) => ({
          url: page.url,
          ok: page.ok,
          finalUrl: page.page?.finalUrl,
          code: page.code,
        })),
      });
      return pages;
    },
  };
}

describeRealModel('real model web search loop', () => {
  it('uses local search tools before answering official-source questions', async () => {
    const baseUrl = requireEnv('REAL_MODEL_BASE_URL').replace(/\/+$/, '');
    const apiKey = requireEnv('REAL_MODEL_API_KEY');
    const model = process.env.REAL_MODEL_NAME?.trim() || 'gemini-2.5-flash-lite';
    const cases = [
      {
        name: 'pytorch-install',
        prompt:
          'Use the web search tools to answer this question: What is the official PyTorch CUDA installation selector page? You must search the web first, read the official page content, then answer in English with the source link.',
        expectedUrls: ['pytorch.org/get-started/locally'],
      },
      {
        name: 'cursor-crack-query',
        prompt:
          'A user searched for "Cursor download free crack". Use the web search tools to find the safe official Cursor download entry. Do not answer after search results alone. You must search the web first, read the official page content with the page reading tool, then explain in English that cracked sites should not be used and include the source link.',
        expectedUrls: ['cursor.com/download'],
      },
      {
        name: 'mdn-fetch-api-docs',
        prompt:
          'Use the web search tools to answer this question: Where is the official MDN Fetch API documentation page? You must search the web first, read the official page content, then summarize its purpose in English with the source link.',
        expectedUrls: ['developer.mozilla.org/en-US/docs/Web/API/Fetch_API'],
      },
      {
        name: 'stripe-secret-key-docs',
        prompt:
          'A user searched for "Stripe API secret key exposed examples". Use the web search tools to find the official Stripe API documentation entry. You must search the web first, read the official page content, then warn in English not to expose secret keys and include the source link.',
        expectedUrls: ['docs.stripe.com/api'],
      },
      {
        name: 'batch-read-download-pages',
        prompt:
          'Use the web search tools to answer this question: What are the official download pages for Node.js and Python? You must search the web first, then use the batch page reading tool once to read both official pages, then briefly compare them in English and include both source links.',
        expectedUrls: [
          'nodejs.org/en/download',
          'python.org/downloads',
        ],
        expectBatchRead: true,
      },
    ];

    for (const testCase of cases) {
      const trace: TraceEvent[] = [];
      const chunks: string[] = [];
      const body: ChatCompletionRequest = {
        model,
        stream: false,
        temperature: 0,
        messages: [{ role: 'user', content: testCase.prompt }],
      };

      const final = await runOpenAIWebSearchJsonToolLoop({
        body,
        client: createLocalWebSearchClient(trace),
        onStatus: (status) => trace.push({ type: 'status', detail: status }),
        onChunk: (chunk) => {
          chunks.push(chunk);
          trace.push({ type: 'chunk', detail: { length: chunk.length } });
        },
        requestJson: async (nextBody) => {
          trace.push({
            type: 'model:request',
            detail: {
              model: nextBody.model,
              messageCount: Array.isArray(nextBody.messages) ? nextBody.messages.length : 0,
              toolCount: Array.isArray(nextBody.tools) ? nextBody.tools.length : 0,
              auth: redactBearer(apiKey),
            },
          });
          const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(nextBody),
          });
          const payload = await response.json() as Record<string, unknown>;
          trace.push({
            type: 'model:response',
            detail: {
              status: response.status,
              toolCalls: JSON.stringify(payload).includes('tool_calls'),
              preview: JSON.stringify(payload).slice(0, 500),
            },
          });
          if (!response.ok) {
            throw new Error(`real model request failed: ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
          }
          return payload;
        },
      });

      expectProcessTrace(trace, testCase.expectedUrls, testCase.expectBatchRead);
      expectSearchResultsAvoidBlockedHosts(trace);
      for (const expectedUrl of testCase.expectedUrls) {
        expect(final).toContain(expectedUrl);
      }
      expect(chunks.length).toBeGreaterThan(0);
    }
  }, 120000);
});
