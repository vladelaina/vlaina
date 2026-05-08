import { describe, expect, it, vi } from 'vitest';
import type { ChatCompletionRequest } from '@/lib/ai/types';
import { runOpenAIWebSearchJsonToolLoop, runOpenAIWebSearchToolLoop } from './openAIToolLoop';
import { extractWebSearchStatuses } from './statusMarkup';

function streamResponse(payloads: Array<Record<string, unknown>>): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const payload of payloads) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
  );
}

describe('OpenAI web search JSON tool loop', () => {
  it('executes requested search tools and forces a page read before the final answer', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'vlaina' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Premature answer from search snippets only.',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with https://example.com',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'vlaina',
        results: [{
          title: 'Vlaina',
          url: 'https://example.com',
          snippet: 'Snippet',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(async () => ({
        title: 'Example',
        summary: '',
        siteName: 'example.com',
        finalUrl: 'https://example.com',
        content: 'Readable page content.',
        charCount: 22,
      })),
      readWebPages: vi.fn(async () => [{
        url: 'https://example.com',
        ok: true,
        page: {
          title: 'Example',
          summary: '',
          siteName: 'example.com',
          finalUrl: 'https://example.com',
          content: 'Readable page content.',
          charCount: 22,
        },
      }]),
    };
    const chunks: string[] = [];
    const body: ChatCompletionRequest = {
      model: 'test',
      stream: true,
      messages: [{ role: 'user', content: 'search vlaina' }],
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body,
      client,
      requestJson,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(client.webSearch).toHaveBeenCalledWith('vlaina', {
      category: undefined,
      timeRange: undefined,
      limit: 5,
    });
    expect(requestJson).toHaveBeenCalledTimes(3);
    const nextMessages = requestJson.mock.calls[1][0].messages;
    expect(nextMessages[nextMessages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-1',
      content: expect.stringContaining('https://example.com'),
    });
    expect(client.readWebPages).toHaveBeenCalledWith(['https://example.com'], {
      contentLimit: 3000,
      retries: 0,
    });
    const pageMessages = requestJson.mock.calls[2][0].messages;
    expect(pageMessages[pageMessages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'forced_read_1',
      content: expect.stringContaining('Readable page content.'),
    });
    expect(final).toContain('<web-search-status>');
    expect(final).toContain('Final answer with https://example.com');
    expect(extractWebSearchStatuses(final).statuses.map((status) => status.phase)).toEqual([
      'searching',
      'results',
      'reading',
      'complete',
    ]);
    expect(chunks[chunks.length - 1]).toBe(final);
  });

  it('adds missing source links when the final answer omits read URLs', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'vlaina' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Premature answer without page reads.',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with https://example.com/source.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'vlaina',
        results: [
          {
            title: 'Vlaina', url: 'https://example.com/source', snippet: 'Snippet',
            publishedAt: null, source: null, thumbnail: null,
          },
          {
            title: 'Second Source', url: 'https://example.com/second', snippet: 'Snippet',
            publishedAt: null, source: null, thumbnail: null,
          },
        ],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [
        {
          url: 'https://example.com/source',
          ok: true,
          page: {
            title: 'Example', summary: '', siteName: 'example.com',
            finalUrl: 'https://example.com/source', content: 'Readable page content.', charCount: 22,
          },
        },
        {
          url: 'https://example.com/second',
          ok: true,
          page: {
            title: 'Second', summary: '', siteName: 'example.com',
            finalUrl: 'https://example.com/second', content: 'Second readable page content.', charCount: 29,
          },
        },
      ]),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search vlaina' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(final).toContain('Sources:\n- https://example.com/second');
    expect(final.match(/- https:\/\/example\.com\/source/g)).toBeNull();
  });

  it('forces a page read in the streaming tool loop before the final answer', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: 'call-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'vlaina' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            content: 'Premature answer from search snippets only.',
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            content: 'Final answer with https://example.com',
          },
        }],
      }]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'vlaina',
        results: [{
          title: 'Vlaina',
          url: 'https://example.com',
          snippet: 'Snippet',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://example.com',
        ok: true,
        page: {
          title: 'Example',
          summary: '',
          siteName: 'example.com',
          finalUrl: 'https://example.com',
          content: 'Readable page content.',
          charCount: 22,
        },
      }]),
    };
    const chunks: string[] = [];
    const body: ChatCompletionRequest = {
      model: 'test',
      stream: true,
      messages: [{ role: 'user', content: 'search vlaina' }],
    };

    const final = await runOpenAIWebSearchToolLoop({
      body,
      client,
      request,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(request).toHaveBeenCalledTimes(3);
    expect(client.readWebPages).toHaveBeenCalledWith(['https://example.com'], {
      contentLimit: 3000,
      retries: 0,
    });
    const pageMessages = request.mock.calls[2][0].messages;
    expect(pageMessages[pageMessages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'forced_read_1',
      content: expect.stringContaining('Readable page content.'),
    });
    expect(final).toContain('<web-search-status>');
    expect(final).toContain('Final answer with https://example.com');
    expect(chunks[chunks.length - 1]).toBe(final);
  });

  it('does not treat a failed page read as a successful source read', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'search-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'vlaina' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'read-1',
              type: 'function',
              function: {
                name: 'read_web_page',
                arguments: JSON.stringify({ url: 'https://bad.example' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Premature answer after failed read.',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with https://good.example',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'vlaina',
        results: [
          {
            title: 'Bad Source',
            url: 'https://bad.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Good Source',
            url: 'https://good.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
        ],
      })),
      readWebPage: vi.fn(async () => {
        throw new Error('timeout');
      }),
      readWebPages: vi.fn(async () => [
        {
          url: 'https://bad.example',
          ok: false,
          error: 'timeout',
          code: 'timeout',
        },
        {
          url: 'https://good.example',
          ok: true,
          page: {
            title: 'Good',
            summary: '',
            siteName: 'good.example',
            finalUrl: 'https://good.example',
            content: 'Readable page content.',
            charCount: 22,
          },
        },
      ]),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search vlaina' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(requestJson).toHaveBeenCalledTimes(4);
    expect(client.readWebPage).toHaveBeenCalledWith('https://bad.example', {
      contentLimit: 3000,
      retries: 0,
    });
    expect(client.readWebPages).toHaveBeenCalledWith(['https://bad.example', 'https://good.example'], {
      contentLimit: 3000,
      retries: 0,
    });
    expect(final).toContain('Final answer with https://good.example');
  });

  it('does not append unread search result links when every page read fails', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'search-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'vlaina' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Premature answer from search snippets.',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer without verified sources.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'vlaina',
        results: [{
          title: 'Unread Source',
          url: 'https://unread.example',
          snippet: 'Snippet',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://unread.example',
        ok: false,
        error: 'timeout',
        code: 'timeout',
      }]),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search vlaina' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.readWebPages).toHaveBeenCalledWith(['https://unread.example'], {
      contentLimit: 3000,
      retries: 0,
    });
    expect(final).toContain('Final answer without verified sources.');
    expect(final).not.toContain('Sources:\n- https://unread.example');
  });
});
