import { describe, expect, it, vi } from 'vitest';
import type { ChatCompletionRequest } from '@/lib/ai/types';
import {
  MAX_LOOP_READ_CACHE_CONTENT_CHARS,
  MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY,
  runOpenAIWebSearchJsonTextProtocolRequest,
  runOpenAIWebSearchJsonToolLoop,
  runOpenAIWebSearchTextProtocolTextRequest,
  runOpenAIWebSearchToolLoop,
} from './openAIToolLoop';
import { extractWebSearchStatuses } from './statusMarkup';
import type { WebPageContent } from './types';

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
  it('stops after a visible JSON answer when the model emits redundant search tool calls', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer after search.',
            tool_calls: [{
              id: 'call-2',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'sample app again' }),
              },
            }],
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [{
          title: 'Sample App',
          url: 'https://example.com',
          snippet: 'Snippet',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };
    const chunks: string[] = [];

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(requestJson.mock.calls[0][0].tools).toHaveLength(3);
    expect(requestJson.mock.calls[0][0].tool_choice).toBeUndefined();
    expect(client.webSearch).toHaveBeenCalledTimes(1);
    expect(client.webSearch).not.toHaveBeenCalledWith('sample app again', expect.anything());
    expect(final).toContain('Final answer after search.');
    expect(extractWebSearchStatuses(final).statuses.map((status) => status.phase)).toEqual([
      'searching',
      'results',
    ]);
    expect(chunks[chunks.length - 1]).toBe(final);
  });

  it('can auto-read top search results in the same JSON tool turn', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer using https://example.com',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [{
          title: 'Sample App',
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

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
      autoReadAfterSearch: true,
    });

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(client.readWebPages).toHaveBeenCalledWith(['https://example.com'], {
      contentLimit: 3000,
      retries: 0,
    });
    expect(client.readWebPage).not.toHaveBeenCalled();
    expect(JSON.stringify(requestJson.mock.calls[1][0].messages)).toContain('Readable page content.');
    expect(requestJson.mock.calls[1][0].tools).toBeUndefined();
    expect(requestJson.mock.calls[1][0].messages.at(-1).content).toContain('Answer now');
    expect(final).toContain('Final answer using https://example.com');
    expect(extractWebSearchStatuses(final).statuses.map((status) => status.phase)).toEqual([
      'searching',
      'results',
      'reading',
      'complete',
    ]);
  });

  it('continues JSON tool execution when a visible answer includes a page read tool call', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Draft answer, but I still need to read the page.',
            tool_calls: [{
              id: 'call-2',
              type: 'function',
              function: {
                name: 'read_web_page',
                arguments: JSON.stringify({ url: 'https://example.com' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer after reading https://example.com',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [{
          title: 'Sample App',
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
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(requestJson).toHaveBeenCalledTimes(3);
    expect(client.readWebPage).toHaveBeenCalledWith('https://example.com', {
      contentLimit: 3000,
      retries: 0,
    });
    expect(final).toContain('Final answer after reading https://example.com');
    expect(extractWebSearchStatuses(final).statuses.map((status) => status.phase)).toEqual([
      'searching',
      'results',
      'reading',
      'complete',
    ]);
  });

  it('caches repeated JSON page reads by the requested URL content', async () => {
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
                name: 'read_pages',
                arguments: JSON.stringify({
                  urls: ['https://example.com/one', 'https://example.com/two'],
                }),
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
              id: 'call-2',
              type: 'function',
              function: {
                name: 'read_url',
                arguments: JSON.stringify({ url: 'https://example.com/one' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer using the first page only.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [
        {
          url: 'https://example.com/one',
          ok: true,
          page: {
            title: 'One',
            summary: '',
            siteName: 'example.com',
            finalUrl: 'https://example.com/one',
            content: 'Only first page content.',
            charCount: 24,
          },
        },
        {
          url: 'https://example.com/two',
          ok: true,
          page: {
            title: 'Two',
            summary: '',
            siteName: 'example.com',
            finalUrl: 'https://example.com/two',
            content: 'Second page content must not be reused.',
            charCount: 39,
          },
        },
      ]),
    };
    client.readWebPage.mockResolvedValueOnce({
      title: 'One',
      summary: '',
      siteName: 'example.com',
      finalUrl: 'https://example.com/one',
      content: 'Only first page content.',
      charCount: 24,
    });

    await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read these pages' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.readWebPages).toHaveBeenCalledTimes(1);
    expect(client.readWebPage).toHaveBeenCalledWith('https://example.com/one', {
      contentLimit: 3000,
      retries: 0,
    });
    const repeatedReadMessages = requestJson.mock.calls[2][0].messages;
    expect(repeatedReadMessages[repeatedReadMessages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-2',
      content: expect.stringContaining('Only first page content.'),
    });
    expect(repeatedReadMessages[repeatedReadMessages.length - 1].content).not.toContain('Second page content must not be reused.');
  });

  it('does not reuse cached reads for unsafe URL spellings', async () => {
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
                name: 'read_url',
                arguments: JSON.stringify({ url: 'https://example.com/@internal.test' }),
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
              id: 'call-2',
              type: 'function',
              function: {
                name: 'read_url',
                arguments: JSON.stringify({ url: 'https://example.com\\@internal.test' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Final answer.' } }],
      });
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(async () => ({
        title: 'Safe page',
        summary: '',
        siteName: 'example.com',
        finalUrl: 'https://example.com/@internal.test',
        content: 'Cached safe page content.',
        charCount: 25,
      })),
      readWebPages: vi.fn(),
    };

    await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read page' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.readWebPage).toHaveBeenCalledTimes(1);
    const unsafeReadMessages = requestJson.mock.calls[2][0].messages;
    const unsafeToolMessage = unsafeReadMessages[unsafeReadMessages.length - 1];
    expect(unsafeToolMessage).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-2',
      content: 'Tool error: Tool call arguments were invalid.',
    });
    expect(unsafeToolMessage.content).not.toContain('Cached safe page content.');
    expect(unsafeToolMessage.content).not.toContain('Cached page read.');
  });

  it('bounds cached batch read URL extraction in JSON tool loops', async () => {
    const urls = Array.from({ length: 12 }, (_, index) => `https://example.com/${index}`);
    const singleReadToolCalls = urls.slice(0, 8).map((url, index) => ({
      id: `read-${index}`,
      type: 'function',
      function: {
        name: 'read_url',
        arguments: JSON.stringify({ url }),
      },
    }));
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: singleReadToolCalls,
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [{
              id: 'call-2',
              type: 'function',
              function: {
                name: 'read_pages',
                arguments: JSON.stringify({ urls }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Final answer.' } }],
      });
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(async (url: string) => ({
        title: url,
        summary: '',
        siteName: 'example.com',
        finalUrl: url,
        content: `Content for ${url}`,
        charCount: 20,
      })),
      readWebPages: vi.fn(async (inputUrls: string[]) =>
        inputUrls.map((url) => ({
          url,
          ok: true,
          page: {
            title: url,
            summary: '',
            siteName: 'example.com',
            finalUrl: url,
            content: `Content for ${url}`,
            charCount: 20,
          },
        }))
      ),
    };

    await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read these pages' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.readWebPage).toHaveBeenCalledTimes(8);
    expect(client.readWebPages).not.toHaveBeenCalled();
    const repeatedReadMessages = requestJson.mock.calls[2][0].messages;
    expect(repeatedReadMessages[repeatedReadMessages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-2',
      content: expect.stringContaining('Content for https://example.com/7'),
    });
    expect(repeatedReadMessages[repeatedReadMessages.length - 1].content).not.toContain('https://example.com/8');
  });

  it('bounds cached read content reused in JSON tool loops', async () => {
    const longContent = 'x'.repeat(MAX_LOOP_READ_CACHE_CONTENT_CHARS + 4096);
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
                name: 'read_url',
                arguments: JSON.stringify({ url: 'https://example.com/large' }),
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
              id: 'call-2',
              type: 'function',
              function: {
                name: 'read_url',
                arguments: JSON.stringify({ url: 'https://example.com/large' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Final answer.' } }],
      });
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(async () => ({
        title: 'Large',
        summary: '',
        siteName: 'example.com',
        finalUrl: 'https://example.com/large',
        content: longContent,
        charCount: longContent.length,
      })),
      readWebPages: vi.fn(),
    };

    await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read large page' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.readWebPage).toHaveBeenCalledTimes(1);
    const repeatedReadMessages = requestJson.mock.calls[2][0].messages;
    const cachedMessage = repeatedReadMessages[repeatedReadMessages.length - 1];
    expect(cachedMessage).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-2',
    });
    expect(cachedMessage.content.length).toBeLessThanOrEqual(
      MAX_LOOP_READ_CACHE_CONTENT_CHARS + 'Cached page read. Use it; do not reread.\n\n'.length
    );
  });

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
                arguments: JSON.stringify({ query: 'sample app' }),
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
        query: 'sample app',
        results: [{
          title: 'Sample App',
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
      messages: [{ role: 'user', content: 'search sample app' }],
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body,
      client,
      requestJson,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(client.webSearch).toHaveBeenCalledWith('sample app', {
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

  it('does not force-read search results without a public URL', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Premature answer.' } }],
      });
    const onApiTranscript = vi.fn();
    const readWebPage = vi.fn();
    const readWebPages = vi.fn();

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client: {
        webSearch: vi.fn(async () => ({
          query: 'sample app',
          results: [{
            title: 'Sample App',
            url: '',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          }],
        })),
        readWebPage,
        readWebPages,
      },
      requestJson,
      onChunk: vi.fn(),
      onApiTranscript,
    });

    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(readWebPage).not.toHaveBeenCalled();
    expect(readWebPages).not.toHaveBeenCalled();
    expect(final).toContain('Premature answer.');
    expect(final).not.toContain('Read one result page');
    expect(onApiTranscript).not.toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('Read one result page'),
      }),
    ]));
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
                arguments: JSON.stringify({ query: 'sample app' }),
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
        query: 'sample app',
        results: [
          {
            title: 'Sample App', url: 'https://example.com/source', snippet: 'Snippet',
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
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(final).toContain('Sources:\n- https://example.com/second');
    expect(final.match(/- https:\/\/example\.com\/source/g)).toBeNull();
  });

  it('does not pre-search by keyword before the JSON model requests a tool', async () => {
    const requestJson = vi.fn().mockResolvedValueOnce({
      choices: [{
        message: { content: 'Model answered without using search.' },
      }],
    });
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'international news background' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).not.toHaveBeenCalled();
    expect(client.readWebPages).not.toHaveBeenCalled();
    expect(requestJson).toHaveBeenCalledTimes(1);
    expect(requestJson.mock.calls[0][0].tools).toHaveLength(3);
    expect(requestJson.mock.calls[0][0].tool_choice).toBeUndefined();
    expect(final).toContain('Model answered without using search.');
  });

  it('answers JSON tool-loop capability questions locally', async () => {
    const requestJson = vi.fn();
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };
    const onChunk = vi.fn();

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: '你可以联网搜索不' }],
      },
      client,
      requestJson,
      onChunk,
    });

    expect(final).toBe('可以，当前聊天已开启联网搜索。');
    expect(onChunk).toHaveBeenCalledWith('可以，当前聊天已开启联网搜索。');
    expect(client.webSearch).not.toHaveBeenCalled();
    expect(requestJson).not.toHaveBeenCalled();
  });

  it('prefetches explicit streaming tool-loop searches locally', async () => {
    const request = vi.fn().mockResolvedValueOnce(streamResponse([
      { choices: [{ delta: { content: 'Answer from prefetched context.' } }] },
    ]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'catime',
        results: [{
          title: 'Catime',
          url: 'https://cati.me/',
          snippet: 'Catime source.',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://cati.me/',
        ok: true,
        page: {
          title: 'Catime',
          summary: '',
          siteName: 'cati.me',
          finalUrl: 'https://cati.me/',
          content: 'Readable Catime source content.',
          charCount: 31,
        },
      }]),
    };

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: '搜一下catime' }],
      },
      client,
      request,
      onChunk: vi.fn(),
    });

    expect(final).toContain('Answer from prefetched context.');
    expect(final).toContain('https://cati.me/');
    expect(client.webSearch).toHaveBeenCalledWith('catime', { limit: 5 });
    expect(client.readWebPages).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].tools).toBeUndefined();
    expect(JSON.stringify(request.mock.calls[0][0].messages)).toContain('Readable Catime source content.');
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
                arguments: JSON.stringify({ query: 'sample app' }),
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
        query: 'sample app',
        results: [{
          title: 'Sample App',
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
      messages: [{ role: 'user', content: 'search sample app' }],
    };

    const final = await runOpenAIWebSearchToolLoop({
      body,
      client,
      request,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0][0].tools).toHaveLength(3);
    expect(request.mock.calls[0][0].tool_choice).toBeUndefined();
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

  it('stops after a visible streaming answer when the model emits redundant search tool calls', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            content: 'Final streamed answer.',
            tool_calls: [{
              index: 0,
              id: 'call-2',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'sample app again' }),
              },
            }],
          },
        }],
      }]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [{
          title: 'Sample App',
          url: 'https://example.com',
          snippet: 'Snippet',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      request,
      onChunk: vi.fn(),
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(client.webSearch).toHaveBeenCalledTimes(1);
    expect(final).toContain('Final streamed answer.');
    expect(extractWebSearchStatuses(final).statuses.map((status) => status.phase)).toEqual([
      'searching',
      'results',
    ]);
  });

  it('continues streaming tool execution when a visible answer includes a page read tool call', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            content: 'Draft streamed answer, but I still need to read the page.',
            tool_calls: [{
              index: 0,
              id: 'call-2',
              type: 'function',
              function: {
                name: 'read_web_page',
                arguments: JSON.stringify({ url: 'https://example.com' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            content: 'Final streamed answer after reading https://example.com',
          },
        }],
      }]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [{
          title: 'Sample App',
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
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      request,
      onChunk: vi.fn(),
    });

    expect(request).toHaveBeenCalledTimes(3);
    expect(client.readWebPage).toHaveBeenCalledWith('https://example.com', {
      contentLimit: 3000,
      retries: 0,
    });
    expect(final).toContain('Final streamed answer after reading https://example.com');
    expect(extractWebSearchStatuses(final).statuses.map((status) => status.phase)).toEqual([
      'searching',
      'results',
      'reading',
      'complete',
    ]);
  });

  it('surfaces streaming provider errors during the web search tool loop', async () => {
    const request = vi.fn().mockResolvedValueOnce(streamResponse([{
      error: {
        message: 'provider stream failed',
      },
    }]));

    await expect(runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client: {
        webSearch: vi.fn(),
        readWebPage: vi.fn(),
        readWebPages: vi.fn(),
      },
      request,
      onChunk: vi.fn(),
    })).rejects.toThrow('provider stream failed');
  });

  it('passes reasoning_content back on streaming assistant tool-call messages', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            reasoning_content: 'Need to search first.',
            tool_calls: [{
              index: 0,
              id: 'call-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([{
        choices: [{ delta: { content: 'Final answer.' } }],
      }]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };
    const onApiTranscript = vi.fn();

    await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      request,
      onChunk: vi.fn(),
      onApiTranscript,
    });

    const nextMessages = request.mock.calls[1][0].messages;
    expect(nextMessages[nextMessages.length - 2]).toMatchObject({
      role: 'assistant',
      content: '',
      reasoning_content: 'Need to search first.',
      tool_calls: expect.any(Array),
    });
    expect(onApiTranscript).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'assistant',
        reasoning_content: 'Need to search first.',
        tool_calls: expect.any(Array),
      }),
    ]));
  });

  it('keeps final API transcript content separate from rendered think markup', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([
        { choices: [{ delta: { reasoning_content: 'Think privately.' } }] },
        { choices: [{ delta: { content: 'Final visible answer.' } }] },
      ]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };
    const onApiTranscript = vi.fn();

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      request,
      onChunk: vi.fn(),
      onApiTranscript,
    });

    expect(final).toContain('<think>Think privately.</think>Final visible answer.');
    const transcript = onApiTranscript.mock.calls[0][0];
    expect(transcript[transcript.length - 1]).toMatchObject({
      role: 'assistant',
      reasoning_content: 'Think privately.',
      content: 'Final visible answer.',
    });
  });

  it('continues the streaming tool loop when the model returns only reasoning after search', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(streamResponse([{
        choices: [{
          delta: {
            reasoning_content: 'Need to search.',
            tool_calls: [{
              index: 0,
              id: 'call-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      }]))
      .mockResolvedValueOnce(streamResponse([
        { choices: [{ delta: { reasoning_content: 'I have enough context.' } }] },
      ]))
      .mockResolvedValueOnce(streamResponse([
        { choices: [{ delta: { content: 'Final visible answer.' } }] },
      ]));
    const client = {
      webSearch: vi.fn(async () => ({ query: 'sample app', results: [] })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };
    const chunks: string[] = [];
    const onApiTranscript = vi.fn();

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      request,
      onChunk: (chunk) => chunks.push(chunk),
      onApiTranscript,
    });

    expect(request).toHaveBeenCalledTimes(3);
    const reminderMessages = request.mock.calls[2][0].messages;
    expect(reminderMessages[reminderMessages.length - 1]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Answer now'),
    });
    expect(final).toContain('Final visible answer.');
    expect(final).not.toContain('I have enough context.');
    expect(chunks[chunks.length - 1]).toBe(final);
    expect(onApiTranscript).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('Answer now'),
      }),
    ]));
  });

  it('continues the JSON tool loop when the model returns only reasoning after search', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            reasoning_content: 'I have enough context.',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final visible answer.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({ query: 'sample app', results: [] })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(requestJson).toHaveBeenCalledTimes(3);
    const reminderMessages = requestJson.mock.calls[2][0].messages;
    expect(reminderMessages[reminderMessages.length - 1]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Answer now'),
    });
    expect(final).toContain('Final visible answer.');
    expect(final).not.toContain('I have enough context.');
  });

  it('runs a final no-tools recovery request instead of completing with only search status and reasoning', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      }]));
    for (let index = 0; index < 5; index += 1) {
      request.mockResolvedValueOnce(streamResponse([
        { choices: [{ delta: { reasoning_content: 'Still thinking.' } }] },
      ]));
    }
    request.mockResolvedValueOnce(streamResponse([
      { choices: [{ delta: { content: 'Recovered final answer with https://example.com' } }] },
    ]));
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [{
          title: 'Sample App',
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

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      request,
      onChunk: vi.fn(),
    });

    expect(request).toHaveBeenCalledTimes(7);
    expect(request.mock.calls[6][0].tools).toBeUndefined();
    expect(request.mock.calls[6][0].tool_choice).toBeUndefined();
    expect(request.mock.calls[6][0].messages.at(-1)).toMatchObject({
      role: 'system',
      content: expect.stringContaining('Answer now'),
    });
    expect(final).toContain('Recovered final answer with https://example.com');
  });

  it('runs a final no-tools JSON recovery request after repeated reasoning-only responses', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      });
    for (let index = 0; index < 5; index += 1) {
      requestJson.mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            reasoning_content: 'Still thinking.',
          },
        }],
      });
    }
    requestJson.mockResolvedValueOnce({
      choices: [{
        message: {
          content: 'Recovered final answer.',
        },
      }],
    });
    const client = {
      webSearch: vi.fn(async () => ({ query: 'sample app', results: [] })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(requestJson).toHaveBeenCalledTimes(7);
    expect(requestJson.mock.calls[6][0].tools).toBeUndefined();
    expect(requestJson.mock.calls[6][0].tool_choice).toBeUndefined();
    expect(final).toContain('Recovered final answer.');
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
                arguments: JSON.stringify({ query: 'sample app' }),
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
        query: 'sample app',
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
        messages: [{ role: 'user', content: 'search sample app' }],
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
                arguments: JSON.stringify({ query: 'sample app' }),
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
        query: 'sample app',
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
        messages: [{ role: 'user', content: 'search sample app' }],
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

  it('keeps trying unread search results when the first forced read batch fails', async () => {
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
                arguments: JSON.stringify({ query: 'sample app' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Premature answer.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Still premature.' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Final answer with https://four.example' } }] });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [
          {
            title: 'Source one',
            url: 'https://one.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Source one duplicate',
            url: 'https://one.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Source two',
            url: 'https://two.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Source three',
            url: 'https://three.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Source four',
            url: 'https://four.example',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
        ],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi
        .fn()
        .mockResolvedValueOnce([
          { url: 'https://one.example', ok: false, error: 'timeout', code: 'timeout' },
          { url: 'https://two.example', ok: false, error: 'timeout', code: 'timeout' },
          { url: 'https://three.example', ok: false, error: 'timeout', code: 'timeout' },
        ])
        .mockResolvedValueOnce([
          {
            url: 'https://four.example',
            ok: true,
            page: {
              title: 'Four',
              summary: '',
              siteName: 'four.example',
              finalUrl: 'https://four.example',
              content: 'Fourth readable page content.',
              charCount: 29,
            },
          },
        ]),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.readWebPages).toHaveBeenNthCalledWith(1, [
      'https://one.example',
      'https://two.example',
      'https://three.example',
    ], {
      contentLimit: 3000,
      retries: 0,
    });
    expect(client.readWebPages).toHaveBeenNthCalledWith(2, ['https://four.example'], {
      contentLimit: 3000,
      retries: 0,
    });
    expect(final).toContain('Final answer with https://four.example');
  });

  it('forces a new page read after later successful searches even when an earlier page was read', async () => {
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
                arguments: JSON.stringify({ query: 'first' }),
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
                arguments: JSON.stringify({ url: 'https://first.example' }),
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
              id: 'search-2',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'second' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Premature answer after the second search.',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with https://second.example',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async (query: string) => ({
        query,
        results: [{
          title: query,
          url: `https://${query}.example`,
          snippet: 'Snippet',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(async (url: string) => ({
        title: url,
        summary: '',
        siteName: new URL(url).hostname,
        finalUrl: url,
        content: 'Readable page content.',
        charCount: 22,
      })),
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

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search twice' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(requestJson).toHaveBeenCalledTimes(5);
    expect(client.readWebPages).toHaveBeenCalledWith(['https://second.example'], {
      contentLimit: 3000,
      retries: 0,
    });
    const forcedReadMessages = requestJson.mock.calls[4][0].messages;
    expect(forcedReadMessages[forcedReadMessages.length - 1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'forced_read_3',
      content: expect.stringContaining('https://second.example'),
    });
    expect(final).toContain('Final answer with https://second.example');
  });

  it('limits model-requested tool concurrency while preserving tool message order', async () => {
    const urls = Array.from(
      { length: MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY + 2 },
      (_value, index) => `https://${index + 1}.example`,
    );
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: urls.map((url, index) => ({
              id: `read-${index + 1}`,
              type: 'function',
              function: {
                name: 'read_web_page',
                arguments: JSON.stringify({ url }),
              },
            })),
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: `Final answer with ${urls.join(' and ')}`,
          },
        }],
      });
    const startedUrls: string[] = [];
    let activeReads = 0;
    let maxActiveReads = 0;
    const resolvers: Array<(page: WebPageContent) => void> = [];
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn((url: string) => new Promise<WebPageContent>((resolve) => {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        startedUrls.push(url);
        resolvers.push((page) => {
          activeReads -= 1;
          resolve(page);
        });
      })),
      readWebPages: vi.fn(),
    };

    const pending = runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read these pages' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(startedUrls).toEqual(urls.slice(0, MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY));
    });
    expect(maxActiveReads).toBeLessThanOrEqual(MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY);

    for (let index = 0; index < MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY; index += 1) {
      resolvers[index]({
        title: `Page ${index + 1}`,
        summary: '',
        siteName: `${index + 1}.example`,
        finalUrl: urls[index],
        content: `Readable page content ${index + 1}.`,
        charCount: 24,
      });
    }

    await vi.waitFor(() => {
      expect(startedUrls).toEqual(urls);
    });
    for (let index = MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY; index < urls.length; index += 1) {
      resolvers[index]({
        title: `Page ${index + 1}`,
        summary: '',
        siteName: `${index + 1}.example`,
        finalUrl: urls[index],
        content: `Readable page content ${index + 1}.`,
        charCount: 24,
      });
    }

    const final = await pending;
    const nextMessages = requestJson.mock.calls[1][0].messages;
    const toolMessages = nextMessages.slice(-urls.length);
    expect(maxActiveReads).toBeLessThanOrEqual(MAX_WEB_SEARCH_TOOL_CALL_CONCURRENCY);
    expect(toolMessages.map((message: { tool_call_id?: string }) => message.tool_call_id)).toEqual(
      urls.map((_url, index) => `read-${index + 1}`),
    );
    for (let index = 0; index < urls.length; index += 1) {
      expect(toolMessages[index].content).toContain(`Readable page content ${index + 1}.`);
    }
    expect(final).toContain(`Final answer with ${urls.join(' and ')}`);
  });

  it('bounds parallel model-requested tools and reuses duplicate tool work while preserving tool message order', async () => {
    const urls = [
      'https://one.example',
      'https://one.example',
      'https://one.example',
      'https://two.example',
      'https://three.example',
      'https://four.example',
      'https://two.example',
    ];
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: urls.map((url, index) => ({
              id: `read-${index + 1}`,
              type: 'function',
              function: {
                name: 'read_web_page',
                arguments: index === 1
                  ? JSON.stringify({ trace: 'ignored-one', url })
                  : index === urls.length - 1
                    ? JSON.stringify({ trace: 'ignored-two', url })
                    : JSON.stringify({ url }),
              },
            })),
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with bounded reads.',
          },
        }],
      });
    const startedUrls: string[] = [];
    const resolvers = new Map<string, (page: WebPageContent) => void>();
    let activeReads = 0;
    let maxActiveReads = 0;
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn((url: string) => new Promise<WebPageContent>((resolve) => {
        startedUrls.push(url);
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        resolvers.set(url, (page) => {
          activeReads -= 1;
          resolve(page);
        });
      })),
      readWebPages: vi.fn(),
    };

    const pending = runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read these pages' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(startedUrls).toEqual([
        'https://one.example',
        'https://two.example',
        'https://three.example',
      ]);
    });
    expect(maxActiveReads).toBe(3);

    for (const url of ['https://one.example', 'https://two.example', 'https://three.example']) {
      resolvers.get(url)?.({
        title: url,
        summary: '',
        siteName: new URL(url).hostname,
        finalUrl: url,
        content: `Readable content for ${url}.`,
        charCount: 30,
      });
    }

    await vi.waitFor(() => {
      expect(startedUrls).toEqual([
        'https://one.example',
        'https://two.example',
        'https://three.example',
        'https://four.example',
      ]);
    });
    resolvers.get('https://four.example')?.({
      title: 'https://four.example',
      summary: '',
      siteName: 'four.example',
      finalUrl: 'https://four.example',
      content: 'Readable content for https://four.example.',
      charCount: 40,
    });

    const final = await pending;
    const nextMessages = requestJson.mock.calls[1][0].messages;
    const toolMessages = nextMessages.slice(-urls.length);
    expect(client.readWebPage).toHaveBeenCalledTimes(4);
    expect(toolMessages.map((message: { tool_call_id?: string }) => message.tool_call_id)).toEqual([
      'read-1',
      'read-2',
      'read-3',
      'read-4',
      'read-5',
      'read-6',
      'read-7',
    ]);
    expect(toolMessages[0].content).toBe(toolMessages[1].content);
    expect(toolMessages[0].content).toBe(toolMessages[2].content);
    expect(toolMessages[3].content).toBe(toolMessages[6].content);
    expect(final).toContain('Final answer with bounded reads.');
  });

  it('stops repeated no-result streaming searches without another model recovery request', async () => {
    const request = vi.fn(async () => streamResponse([
      {
        choices: [{
          delta: {
            reasoning_content: 'Need another search.',
            content: 'Searching again.',
            tool_calls: [{
              index: 0,
              id: 'search-1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'loop' }),
              },
            }],
          },
        }],
      },
    ]));
    const client = {
      webSearch: vi.fn(async () => ({ query: 'loop', results: [] })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };
    const onApiTranscript = vi.fn();

    const final = await runOpenAIWebSearchToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search loop' }],
      },
      client,
      request,
      onChunk: vi.fn(),
      onApiTranscript,
    });

    expect(request).toHaveBeenCalledTimes(3);
    expect(final).toContain('I tried several search queries');
    expect(final).not.toContain('<think>');
    const transcript = onApiTranscript.mock.calls[0][0];
    expect(transcript[transcript.length - 1]).toMatchObject({
      role: 'assistant',
      content: expect.stringContaining('I tried several search queries'),
    });
  });

  it('does not expose DeepSeek DSML tool markup after repeated no-result searches', async () => {
    const dsmlToolCall = [
      '<｜｜DSML｜｜tool_calls>',
      '<｜｜DSML｜｜invoke name="web_search">',
      '<｜｜DSML｜｜parameter name="query" string="true">OpenAI Codex model version gpt</｜｜DSML｜｜parameter>',
      '</｜｜DSML｜｜invoke>',
      '</｜｜DSML｜｜tool_calls>',
    ].join('\n');
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
                arguments: JSON.stringify({ query: 'Codex latest version 2026' }),
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
              id: 'search-2',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: 'OpenAI Codex latest version' }),
              },
            }],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: dsmlToolCall,
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: dsmlToolCall,
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async (query: string) => ({ query, results: [] })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: '帮我看看 Codex 版本信息' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).toHaveBeenCalledTimes(3);
    expect(requestJson).toHaveBeenCalledTimes(3);
    expect(final).toContain('连续尝试了几个搜索词');
    expect(final).not.toContain('DSML');
    expect(final).not.toContain('tool_calls');
  });

  it('filters unsafe JSON text-protocol search URLs before reading or prompting', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '<web_search_request>{"query":"sample app","reason":"need sources"}</web_search_request>',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with https://example.com/safe',
          },
        }],
      });
    const statuses: unknown[] = [];
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'sample app',
        results: [
          {
            title: 'Loopback',
            url: 'http://127.0.0.1:3000/admin',
            snippet: 'Bad',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Safe',
            url: 'https://example.com/safe',
            snippet: 'Good',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
          {
            title: 'Relative',
            url: '/internal',
            snippet: 'Bad',
            publishedAt: null,
            source: null,
            thumbnail: null,
          },
        ],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async (urls: string[]) => urls.map((url) => ({
        url,
        ok: true,
        page: {
          title: 'Safe',
          summary: '',
          siteName: 'example.com',
          finalUrl: url,
          content: 'Readable safe page content.',
          charCount: 27,
        },
      }))),
    };

    const final = await runOpenAIWebSearchJsonTextProtocolRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'sample app overview' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
      onStatus: (status) => statuses.push(status),
    });

    expect(client.readWebPages).toHaveBeenCalledWith(['https://example.com/safe'], {
      contentLimit: 3000,
      retries: 0,
    });
    const answerPrompt = JSON.stringify(requestJson.mock.calls[1][0].messages);
    expect(answerPrompt).toContain('https://example.com/safe');
    expect(answerPrompt).not.toContain('127.0.0.1');
    expect(answerPrompt).not.toContain('/internal');
    expect(statuses).toEqual([
      { phase: 'searching', query: 'sample app' },
      {
        phase: 'results',
        query: 'sample app',
        results: [{
          title: 'Safe',
          url: 'https://example.com/safe',
          snippet: 'Good',
          publishedAt: null,
        }],
        metrics: {
          durationMs: expect.any(Number),
          resultCount: 1,
        },
      },
      { phase: 'reading', urls: ['https://example.com/safe'] },
      {
        phase: 'complete',
        urls: ['https://example.com/safe'],
        failedSources: [],
        metrics: {
          durationMs: expect.any(Number),
          failureCount: 0,
          successCount: 1,
        },
      },
    ]);
    expect(final).toContain('https://example.com/safe');
    expect(final).not.toContain('127.0.0.1');
    expect(final).not.toContain('/internal');
  });

  it('uses a text-protocol search request when only the nonessential JSON fields are malformed', async () => {
    const leakedDecision = [
      '我们需要理解用户请求：用户说“你搜一下catime”。',
      '',
      '<web_search_request>{"query":"catime","reason":"用户要求搜索 "catime"，需要获取其定义或相关信息。"}</web_search_request>',
    ].join('\n');
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: leakedDecision,
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Catime answer from search.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'catime',
        results: [{
          title: 'Catime',
          url: 'https://cati.me/',
          snippet: 'Catime source.',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://cati.me/',
        ok: true,
        page: {
          title: 'Catime',
          summary: '',
          siteName: 'cati.me',
          finalUrl: 'https://cati.me/',
          content: 'Readable Catime source content.',
          charCount: 31,
        },
      }]),
    };

    const final = await runOpenAIWebSearchJsonTextProtocolRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'catime info' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).toHaveBeenCalledWith('catime', { limit: 5 });
    expect(requestJson).toHaveBeenCalledTimes(2);
    expect(final).toContain('Catime answer from search.');
    expect(final).not.toContain('我们需要理解用户请求');
    expect(final).not.toContain('<web_search_request>');
  });

  it('parses an unfinished text-protocol search request after leaked decision text', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: [
              '需要先搜索。',
              '<web_search_request>{"query":"catime","reason":"current info"',
            ].join('\n'),
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Catime answer after unfinished request.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'catime',
        results: [{
          title: 'Catime',
          url: 'https://cati.me/',
          snippet: 'Catime source.',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://cati.me/',
        ok: true,
        page: {
          title: 'Catime',
          summary: '',
          siteName: 'cati.me',
          finalUrl: 'https://cati.me/',
          content: 'Readable Catime source content.',
          charCount: 31,
        },
      }]),
    };

    const final = await runOpenAIWebSearchJsonTextProtocolRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'catime info' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).toHaveBeenCalledWith('catime', { limit: 5 });
    expect(final).toContain('Catime answer after unfinished request.');
    expect(final).not.toContain('需要先搜索');
    expect(final).not.toContain('<web_search_request>');
  });

  it('falls back to the latest user text when a text-protocol search request has no parseable query', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I should search.\n<web_search_request>{"reason":"need current info"}</web_search_request>',
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Fallback query answer.',
          },
        }],
      });
    const client = {
      webSearch: vi.fn(async () => ({
        query: 'catime',
        results: [{
          title: 'Catime',
          url: 'https://cati.me/',
          snippet: 'Catime source.',
          publishedAt: null,
          source: null,
          thumbnail: null,
        }],
      })),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(async () => [{
        url: 'https://cati.me/',
        ok: true,
        page: {
          title: 'Catime',
          summary: '',
          siteName: 'cati.me',
          finalUrl: 'https://cati.me/',
          content: 'Readable Catime source content.',
          charCount: 31,
        },
      }]),
    };

    const final = await runOpenAIWebSearchJsonTextProtocolRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'catime' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).toHaveBeenCalledWith('catime', { limit: 5 });
    expect(final).toContain('Fallback query answer.');
    expect(final).not.toContain('I should search.');
    expect(final).not.toContain('<web_search_request>');
  });

  it('ignores oversized JSON text-protocol search requests', async () => {
    const requestJson = vi.fn().mockResolvedValueOnce({
      choices: [{
        message: {
          content: `<web_search_request>${JSON.stringify({
            query: 'sample app',
            reason: 'x'.repeat(70 * 1024),
          })}</web_search_request>Direct answer instead.`,
        },
      }],
    });
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn(),
      readWebPages: vi.fn(),
    };

    const final = await runOpenAIWebSearchJsonTextProtocolRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'sample app overview' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).not.toHaveBeenCalled();
    expect(requestJson).toHaveBeenCalledTimes(1);
    expect(final).toContain('Direct answer instead.');
    expect(final).not.toContain('<web_search_request>');
  });

  it('does not emit a final JSON tool-loop answer after cancellation during response parsing', async () => {
    const controller = new AbortController();
    const requestJson = vi.fn(async () => {
      controller.abort();
      return {
        choices: [{
          message: {
            content: 'Final answer after cancellation.',
          },
        }],
      };
    });
    const onChunk = vi.fn();
    const onApiTranscript = vi.fn();

    await expect(runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'answer directly' }],
      },
      client: {
        webSearch: vi.fn(),
        readWebPage: vi.fn(),
        readWebPages: vi.fn(),
      },
      requestJson,
      onChunk,
      onApiTranscript,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });

    expect(onChunk).not.toHaveBeenCalled();
    expect(onApiTranscript).not.toHaveBeenCalled();
  });

  it('does not emit a direct JSON text-protocol answer after cancellation during response parsing', async () => {
    const controller = new AbortController();
    const requestJson = vi.fn(async () => {
      controller.abort();
      return {
        choices: [{
          message: {
            content: 'Direct answer after cancellation.',
          },
        }],
      };
    });
    const onChunk = vi.fn();
    const onApiTranscript = vi.fn();

    await expect(runOpenAIWebSearchJsonTextProtocolRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'answer directly' }],
      },
      client: {
        webSearch: vi.fn(),
        readWebPage: vi.fn(),
        readWebPages: vi.fn(),
      },
      requestJson,
      onChunk,
      onApiTranscript,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });

    expect(onChunk).not.toHaveBeenCalled();
    expect(onApiTranscript).not.toHaveBeenCalled();
  });

  it('does not emit a direct text-protocol answer after cancellation during response parsing', async () => {
    const controller = new AbortController();
    const requestText = vi.fn(async () => {
      controller.abort();
      return 'Direct answer after cancellation.';
    });
    const onChunk = vi.fn();
    const onApiTranscript = vi.fn();

    await expect(runOpenAIWebSearchTextProtocolTextRequest({
      body: {
        model: 'test',
        stream: false,
        messages: [{ role: 'user', content: 'answer directly' }],
      },
      client: {
        webSearch: vi.fn(),
        readWebPage: vi.fn(),
        readWebPages: vi.fn(),
      },
      requestText,
      onChunk,
      onApiTranscript,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });

    expect(onChunk).not.toHaveBeenCalled();
    expect(onApiTranscript).not.toHaveBeenCalled();
  });
});
