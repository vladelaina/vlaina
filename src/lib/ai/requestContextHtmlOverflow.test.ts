import { describe, expect, it } from 'vitest';
import { sanitizeHistory } from './requestContext';
import type { ChatMessage } from './types';

function createMessage(content: string): ChatMessage {
  const timestamp = Date.now();
  return {
    id: 'm1',
    role: 'user',
    content,
    modelId: 'model-1',
    timestamp,
    versions: [{ content, createdAt: timestamp, kind: 'original', subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

describe('requestContext HTML overflow image scrubbing', () => {
  it('does not leak image sources hidden behind oversized HTML attributes', () => {
    const content = [
      ...Array.from({ length: 4001 }, (_, index) => `<span data-index="${index}"></span>`),
      `<img alt="${'a'.repeat(5000)}" src="attachment://secret.png"> after`,
    ].join('');

    const sanitized = sanitizeHistory([createMessage(content)]);

    expect(sanitized[0].content).not.toContain('attachment://secret.png');
    expect(sanitized[0].content).not.toContain('<img');
    expect(sanitized[0].content).toContain('[Image] after');
  });

  it('does not leak image sources after oversized HTML image tag scans', () => {
    const content = [
      `<img alt="${'a'.repeat(80 * 1024)}" src="attachment://secret.png">`,
      'after',
    ].join('\n');

    const sanitized = sanitizeHistory([createMessage(content)]);

    expect(sanitized[0].content).not.toContain('attachment://secret.png');
    expect(sanitized[0].content).not.toContain('<img');
    expect(sanitized[0].content).toContain('[Image]\nafter');
  });
});
