import { describe, expect, it, vi } from 'vitest';
import type { ChatCompletionRequest } from '@/lib/ai/types';
import { runOpenAIWebSearchJsonToolLoop, runOpenAIWebSearchToolLoop } from './openAIToolLoop';
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

  it('keeps forced-read reminder messages in the hidden transcript when no readable URL exists', async () => {
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
        choices: [{ message: { content: 'Premature answer.' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Final answer.' } }],
      });
    const onApiTranscript = vi.fn();

    await runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'search vlaina' }],
      },
      client: {
        webSearch: vi.fn(async () => ({
          query: 'vlaina',
          results: [{
            title: 'Vlaina',
            url: '',
            snippet: 'Snippet',
            publishedAt: null,
            source: null,
            thumbnail: null,
          }],
        })),
        readWebPage: vi.fn(),
        readWebPages: vi.fn(),
      },
      requestJson,
      onChunk: vi.fn(),
      onApiTranscript,
    });

    expect(requestJson).toHaveBeenCalledTimes(3);
    const reminderMessages = requestJson.mock.calls[2][0].messages;
    expect(reminderMessages[reminderMessages.length - 1]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('read_web_page'),
    });
    expect(onApiTranscript).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('read_web_page'),
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
        messages: [{ role: 'user', content: 'search vlaina' }],
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
                arguments: JSON.stringify({ query: 'vlaina' }),
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
        query: 'vlaina',
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
        messages: [{ role: 'user', content: 'search vlaina' }],
      },
      client,
      request,
      onChunk: vi.fn(),
      onApiTranscript,
    });

    const nextMessages = request.mock.calls[1][0].messages;
    expect(nextMessages[nextMessages.length - 2]).toMatchObject({
      role: 'assistant',
      content: null,
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
                arguments: JSON.stringify({ query: 'vlaina' }),
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
        query: 'vlaina',
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
        messages: [{ role: 'user', content: 'search vlaina' }],
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

  it('runs multiple model-requested tools in parallel while preserving tool message order', async () => {
    const requestJson = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: '',
            tool_calls: [
              {
                id: 'read-1',
                type: 'function',
                function: {
                  name: 'read_web_page',
                  arguments: JSON.stringify({ url: 'https://one.example' }),
                },
              },
              {
                id: 'read-2',
                type: 'function',
                function: {
                  name: 'read_web_page',
                  arguments: JSON.stringify({ url: 'https://two.example' }),
                },
              },
            ],
          },
        }],
      })
      .mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Final answer with https://one.example and https://two.example',
          },
        }],
      });
    const startedUrls: string[] = [];
    const resolvers: Array<(page: WebPageContent) => void> = [];
    const client = {
      webSearch: vi.fn(),
      readWebPage: vi.fn((url: string) => new Promise<WebPageContent>((resolve) => {
        startedUrls.push(url);
        resolvers.push(resolve);
      })),
      readWebPages: vi.fn(),
    };

    const pending = runOpenAIWebSearchJsonToolLoop({
      body: {
        model: 'test',
        stream: true,
        messages: [{ role: 'user', content: 'read these two pages' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    await vi.waitFor(() => {
      expect(startedUrls).toEqual(['https://one.example', 'https://two.example']);
    });

    resolvers[1]({
      title: 'Two',
      summary: '',
      siteName: 'two.example',
      finalUrl: 'https://two.example',
      content: 'Second readable page content.',
      charCount: 29,
    });
    resolvers[0]({
      title: 'One',
      summary: '',
      siteName: 'one.example',
      finalUrl: 'https://one.example',
      content: 'First readable page content.',
      charCount: 28,
    });

    const final = await pending;
    const nextMessages = requestJson.mock.calls[1][0].messages;
    const toolMessages = nextMessages.slice(-2);
    expect(toolMessages.map((message: { tool_call_id?: string }) => message.tool_call_id)).toEqual(['read-1', 'read-2']);
    expect(toolMessages[0].content).toContain('First readable page content.');
    expect(toolMessages[1].content).toContain('Second readable page content.');
    expect(final).toContain('Final answer with https://one.example and https://two.example');
  });

  it('keeps max-loop fallback API transcript free of rendered think markup', async () => {
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

    expect(request).toHaveBeenCalledTimes(6);
    expect(final).toContain('<think>Need another search.</think>Searching again.');
    const transcript = onApiTranscript.mock.calls[0][0];
    expect(transcript[transcript.length - 1]).toMatchObject({
      role: 'assistant',
      content: 'Searching again.',
      reasoning_content: 'Need another search.',
    });
  });
});
