import { describe, expect, it } from 'vitest';
import { normalizeSessionMessages } from './chatStorageNormalization';

describe('chat web search status storage', () => {
  it('restores sanitized statuses from the active message version', () => {
    const [message] = normalizeSessionMessages([{
      id: 'assistant-1',
      role: 'assistant',
      content: 'Answer',
      modelId: 'model-1',
      timestamp: 1,
      currentVersionIndex: 0,
      versions: [{
        content: 'Answer',
        createdAt: 1,
        kind: 'original',
        subsequentMessages: [],
        webSearchStatuses: [{
          phase: 'complete',
          urls: ['https://example.com', 'http://127.0.0.1/private'],
          metrics: { successCount: 1 },
        }],
      }],
    }]);

    expect(message.webSearchStatuses).toEqual([{
      phase: 'complete',
      urls: ['https://example.com'],
      metrics: { successCount: 1 },
    }]);
    expect(message.versions[0].webSearchStatuses).toEqual(message.webSearchStatuses);
  });
});
