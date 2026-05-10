import { describe, expect, it, vi } from 'vitest';
import { normalizeSessionMessages } from './chatStorage';

describe('chatStorage session message normalization', () => {
  it('backfills versions for legacy persisted messages', () => {
    vi.setSystemTime(new Date('2026-05-09T00:00:00Z'));

    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'Legacy answer',
      modelId: 'model-1',
      timestamp: 1,
      apiTranscript: [{ role: 'assistant', content: 'Legacy answer', reasoning_content: 'hidden' }],
    }]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: 'm1',
      role: 'assistant',
      content: 'Legacy answer',
      currentVersionIndex: 0,
    });
    expect(messages[0]?.versions).toEqual([{
      content: 'Legacy answer',
      createdAt: 1,
      subsequentMessages: [],
      apiTranscript: [{ role: 'assistant', content: 'Legacy answer', reasoning_content: 'hidden' }],
    }]);
  });

  it('clamps invalid current version indexes and recursively normalizes branch messages', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'user',
      content: 'Edited prompt',
      modelId: 'model-1',
      timestamp: 1,
      currentVersionIndex: 99,
      versions: [{
        content: 'Original prompt',
        createdAt: 1,
        subsequentMessages: [{
          id: 'a1',
          role: 'assistant',
          content: 'Legacy branch answer',
          modelId: 'model-1',
          timestamp: 2,
        }],
      }],
    }]);

    expect(messages[0]?.currentVersionIndex).toBe(0);
    expect(messages[0]?.versions[0]?.subsequentMessages[0]).toMatchObject({
      id: 'a1',
      role: 'assistant',
      content: 'Legacy branch answer',
      currentVersionIndex: 0,
      versions: [{
        content: 'Legacy branch answer',
        createdAt: 2,
        subsequentMessages: [],
      }],
    });
  });

  it('drops invalid message records instead of exposing malformed chat state', () => {
    const messages = normalizeSessionMessages([
      { id: 'bad-role', role: 'tool', content: 'bad' },
      null,
      { id: 'ok', role: 'user', content: 'hello', modelId: 'model-1', timestamp: 1 },
    ]);

    expect(messages.map((message) => message.id)).toEqual(['ok']);
  });

  it('normalizes hidden API transcripts before they can be replayed', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'answer',
      modelId: 'model-1',
      timestamp: 1,
      apiTranscript: [
        {
          role: 'assistant',
          content: 'answer',
          reasoning_content: 'hidden',
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'web_search', arguments: '{"query":"catime"}' },
            },
            { id: 'bad', type: 'function', function: { name: 'broken', arguments: 1 } },
          ],
        },
        { role: 'tool', content: 'missing tool id' },
        { role: 'tool', tool_call_id: 'call-1', name: 'web_search', content: 'result' },
        { role: 'invalid', content: 'bad' },
      ],
    }]);

    expect(messages[0]?.apiTranscript).toEqual([
      {
        role: 'assistant',
        content: 'answer',
        reasoning_content: 'hidden',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'web_search', arguments: '{"query":"catime"}' },
        }],
      },
      { role: 'tool', content: 'result', tool_call_id: 'call-1', name: 'web_search' },
    ]);
    expect(messages[0]?.versions[0]?.apiTranscript).toEqual(messages[0]?.apiTranscript);
  });

  it('fills required transcript content fields for provider compatibility', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'answer',
      modelId: 'model-1',
      timestamp: 1,
      apiTranscript: [
        { role: 'system' },
        { role: 'user' },
        { role: 'tool', tool_call_id: 'call-1' },
      ],
    }]);

    expect(messages[0]?.apiTranscript).toEqual([
      { role: 'system', content: '' },
      { role: 'user', content: '' },
      { role: 'tool', tool_call_id: 'call-1', content: '' },
    ]);
  });
});
