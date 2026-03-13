import { describe, expect, it } from 'vitest';
import { buildRequestHistory, sanitizeHistory } from './requestContext';
import type { ChatMessage } from './types';

function createMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: overrides.id || 'm1',
    role: overrides.role || 'user',
    content: overrides.content || '',
    modelId: overrides.modelId || 'model-1',
    timestamp: overrides.timestamp || Date.now(),
    ...overrides,
  };
}

describe('requestContext', () => {
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
      createMessage({ role: 'user', content: '![image](asset://a)\n\ndescribe it' }),
    ];

    const sanitized = sanitizeHistory(history);
    expect(sanitized[0].content).toBe('[Image]\n\ndescribe it');
  });
});
