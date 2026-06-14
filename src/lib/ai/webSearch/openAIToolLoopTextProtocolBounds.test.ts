import { describe, expect, it, vi } from 'vitest';
import { runOpenAIWebSearchJsonTextProtocolRequest } from './openAIToolLoop';

describe('OpenAI web search text protocol bounds', () => {
  it('ignores overlong raw JSON search queries before trimming', async () => {
    const requestJson = vi.fn().mockResolvedValueOnce({
      choices: [{
        message: {
          content: `<web_search_request>${JSON.stringify({
            query: `${' '.repeat(1001)}sample app`,
            reason: 'need sources',
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
        messages: [{ role: 'user', content: 'search sample app' }],
      },
      client,
      requestJson,
      onChunk: vi.fn(),
    });

    expect(client.webSearch).not.toHaveBeenCalled();
    expect(final).toContain('Direct answer instead.');
  });
});
