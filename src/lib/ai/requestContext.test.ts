import { describe, expect, it, vi } from 'vitest';
import { buildRequestHistory, measureRequestJsonLength, sanitizeHistory } from './requestContext';
import type { ChatMessage } from './types';

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  const content = overrides.content ?? '';
  const timestamp = overrides.timestamp ?? Date.now();
  return {
    id: overrides.id ?? 'm1',
    role: overrides.role ?? 'user',
    content,
    modelId: overrides.modelId ?? 'model-1',
    timestamp,
    ...(overrides.apiTranscript !== undefined ? { apiTranscript: overrides.apiTranscript } : {}),
    ...(overrides.imageSources !== undefined ? { imageSources: overrides.imageSources } : {}),
    versions:
      overrides.versions ?? [{ content, createdAt: timestamp, kind: 'original' as const, subsequentMessages: [] }],
    currentVersionIndex: overrides.currentVersionIndex ?? 0,
  };
}

describe('requestContext', () => {
  it('measures JSON length without serializing the full value', () => {
    const value = [
      {
        role: 'assistant',
        content: 'quote " slash \\ newline \n emoji 😀 lone \uD800',
        reasoning_content: 'hidden',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'web_search', arguments: '{"query":"x"}' },
        }],
      },
      undefined,
      null,
    ];
    const serialized = JSON.stringify(value);

    expect(measureRequestJsonLength(value, serialized.length + 1)).toBe(serialized.length);
    expect(measureRequestJsonLength(value, 16)).toBeGreaterThan(16);
  });

  it('prepends custom system prompt and time context when enabled', () => {
    const history = [
      createMessage({ role: 'user', content: 'hello there' }),
      createMessage({ role: 'assistant', content: 'hi' }),
    ];

    const result = buildRequestHistory({
      history,
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: true,
      customSystemPrompt: 'Always answer in Chinese',
    });

    const systemMessages = result.filter((msg) => msg.role === 'system');
    expect(systemMessages).toHaveLength(1);
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('Always answer in Chinese');
    expect(result[0].content).toContain('Current Date/Time:');
    expect(result[1].content).toBe('hello there');
  });

  it('skips time context when includeTimeContext is false', () => {
    const history = [createMessage({ role: 'user', content: 'what time is it?' })];

    const result = buildRequestHistory({
      history,
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
      customSystemPrompt: 'Reply shortly',
    });

    const systemMessages = result.filter((msg) => msg.role === 'system');
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0].content).toBe('Reply shortly');
  });

  it('sanitizes markdown image tokens in history', () => {
    const history = [
      createMessage({ role: 'user', content: '![image](attachment://safe.png)\n\ndescribe it' }),
    ];

    const sanitized = sanitizeHistory(history);
    expect(sanitized[0].content).toBe('[Image]\n\ndescribe it');
  });

  it('sanitizes only renderable markdown image tokens in history', () => {
    const content = [
      'Look ![outer [nested]](<attachment://safe.png> "Title") and ![plain](data:image/png;base64,REAL "Title") and ![blocked](asset://localhost/image.png)',
      'Watch ![video](https://example.com/movie.mp4)',
      '```md',
      '![example](asset://code.png)',
      '```',
      String.raw`\![literal](asset://escaped.png)`,
    ].join('\n');

    const sanitized = sanitizeHistory([createMessage({ role: 'user', content })]);

    expect(sanitized[0].content).toBe([
      'Look [Image] and [Image] and ![blocked](asset://localhost/image.png)',
      'Watch ![video](https://example.com/movie.mp4)',
      '```md',
      '![example](asset://code.png)',
      '```',
      String.raw`\![literal](asset://escaped.png)`,
    ].join('\n'));
  });

  it('removes web search status markup from model history', () => {
    const history = [
      createMessage({
        role: 'assistant',
        content: '<web-search-status>{"phase":"results","query":"x"}</web-search-status>\n\nFinal answer',
      }),
    ];

    const sanitized = sanitizeHistory(history);
    expect(sanitized[0].content).toBe('Final answer');
  });

  it('removes rendered thinking markup from fallback model history', () => {
    const history = [
      createMessage({
        role: 'assistant',
        content: '<think>private reasoning</think>Final answer',
      }),
    ];

    const sanitized = sanitizeHistory(history);
    expect(sanitized[0].content).toBe('Final answer');
  });

  it('removes UI-only assistant error messages from model history', () => {
    const history = [
      createMessage({ role: 'user', content: 'hello' }),
      createMessage({
        role: 'assistant',
        content: '<error type="AUTH_ERROR" code="401">Your sign-in session has expired. Please sign in again and try again.</error>',
      }),
      createMessage({ role: 'user', content: 'are you there?' }),
    ];

    const result = buildRequestHistory({
      history,
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
    });

    expect(result.map((message) => message.content)).toEqual(['hello', 'are you there?']);
  });

  it('strips assistant error tags without dropping visible assistant content', () => {
    const sanitized = sanitizeHistory([
      createMessage({
        role: 'assistant',
        content: 'Partial answer<error type="NETWORK_ERROR" code="503">Request failed</error>',
      }),
    ]);

    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].content).toBe('Partial answer');
  });

  it('does not read older messages once the request history message budget is filled', () => {
    const oldMessage = createMessage({ id: 'old', role: 'user', content: 'old' });
    Object.defineProperty(oldMessage, 'content', {
      configurable: true,
      get() {
        throw new Error('old message content should not be read');
      },
    });
    const recentMessages = Array.from({ length: 32 }, (_, index) =>
      createMessage({ id: `recent-${index}`, role: 'user', content: `recent-${index}` })
    );

    const result = buildRequestHistory({
      history: [oldMessage, ...recentMessages],
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
    });

    expect(result.map((message) => message.content)).toEqual(
      recentMessages.map((message) => message.content),
    );
  });

  it('compacts oversized hidden API transcripts instead of dropping reasoning content', () => {
    const result = buildRequestHistory({
      history: [
        createMessage({
          role: 'assistant',
          content: 'Visible answer',
          apiTranscript: [
            {
              role: 'assistant',
              content: null,
              reasoning_content: 'hidden plan',
              tool_calls: [{
                id: 'call-1',
                type: 'function',
                function: { name: 'web_search', arguments: '{"query":"x"}' },
              }],
            },
            {
              role: 'tool',
              tool_call_id: 'call-1',
              name: 'web_search',
              content: 'x'.repeat(30000),
            },
            {
              role: 'assistant',
              content: 'Final answer',
              reasoning_content: 'final hidden reasoning',
            },
          ],
        }),
      ],
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Visible answer');
    expect(result[0].apiTranscript).toHaveLength(3);
    expect(result[0].apiTranscript?.[0]).toMatchObject({
      role: 'assistant',
      content: '',
      reasoning_content: 'hidden plan',
      tool_calls: expect.any(Array),
    });
    expect(result[0].apiTranscript?.[1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-1',
      content: expect.stringContaining('[Earlier content omitted]'),
    });
    expect(result[0].apiTranscript?.[2]).toMatchObject({
      role: 'assistant',
      content: 'Final answer',
      reasoning_content: 'final hidden reasoning',
    });
    expect(JSON.stringify(result[0].apiTranscript).length).toBeLessThanOrEqual(6000);
  });

  it('builds request history transcript budgets without calling JSON.stringify', () => {
    const stringifySpy = vi.spyOn(JSON, 'stringify').mockImplementation(() => {
      throw new Error('JSON.stringify should not be used for request history budgeting');
    });

    try {
      const result = buildRequestHistory({
        history: [
          createMessage({
            role: 'assistant',
            content: 'Visible answer',
            apiTranscript: [
              {
                role: 'assistant',
                content: null,
                reasoning_content: 'hidden plan',
                tool_calls: [{
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'web_search', arguments: '{"query":"x"}' },
                }],
              },
              {
                role: 'tool',
                tool_call_id: 'call-1',
                name: 'web_search',
                content: 'x'.repeat(30000),
              },
              {
                role: 'assistant',
                content: 'Final answer',
                reasoning_content: 'final hidden reasoning',
              },
            ],
          }),
        ],
        modelId: 'model-1',
        timezoneOffset: 8,
        includeTimeContext: false,
      });

      expect(result).toHaveLength(1);
      expect(result[0].apiTranscript).toHaveLength(3);
      expect(result[0].apiTranscript?.[1]?.content).toContain('[Earlier content omitted]');
    } finally {
      stringifySpy.mockRestore();
    }
  });

  it('normalizes hidden API transcripts before request history budgeting reads them', () => {
    const oldestTranscriptMessage = { role: 'assistant' as const };
    Object.defineProperty(oldestTranscriptMessage, 'content', {
      configurable: true,
      get() {
        throw new Error('old transcript content should not be read');
      },
    });
    const transcript = [
      oldestTranscriptMessage,
      ...Array.from({ length: 79 }, (_, index) => ({
        role: 'assistant' as const,
        content: `transcript-${index}`,
      })),
    ];

    const result = buildRequestHistory({
      history: [
        createMessage({
          role: 'assistant',
          content: 'Visible answer',
          apiTranscript: transcript,
        }),
      ],
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
    });

    expect(result[0]?.apiTranscript?.[0]?.content).toBe('transcript-15');
    expect(result[0]?.apiTranscript?.at(-1)?.content).toBe('transcript-78');
  });

  it('moves active version transcripts to the bounded top-level request field', () => {
    const apiTranscript = [{ role: 'assistant' as const, content: 'version answer', reasoning_content: 'hidden' }];

    const result = buildRequestHistory({
      history: [
        createMessage({
          role: 'assistant',
          content: 'Version answer',
          versions: [{
            content: 'Version answer',
            createdAt: 1,
            kind: 'original',
            subsequentMessages: [],
            apiTranscript,
          }],
        }),
      ],
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
    });

    expect(result[0]?.apiTranscript).toEqual(apiTranscript);
    expect(result[0]?.versions[0]?.apiTranscript).toBeUndefined();
  });

  it('does not leave orphan oversized version transcripts available for provider fallback replay', () => {
    const hugeTranscript = [{
      role: 'tool' as const,
      tool_call_id: 'call-1',
      content: 'x'.repeat(50000),
    }];

    const result = buildRequestHistory({
      history: [
        createMessage({
          role: 'assistant',
          content: 'Visible answer',
          versions: [{
            content: 'Visible answer',
            createdAt: 1,
            kind: 'original',
            subsequentMessages: [],
            apiTranscript: hugeTranscript,
          }],
        }),
      ],
      modelId: 'model-1',
      timezoneOffset: 8,
      includeTimeContext: false,
    });

    expect(result[0]?.apiTranscript).toBeUndefined();
    expect(result[0]?.versions[0]?.apiTranscript).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('x'.repeat(5000));
  });
});
