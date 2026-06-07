import { describe, expect, it, vi } from 'vitest';
import { normalizeSessionMessages } from './chatStorage';

function createRawMessage(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    role: 'assistant',
    content: id,
    modelId: 'model-1',
    timestamp: 1,
    ...overrides,
  };
}

describe('chatStorage normalization bounds', () => {
  it('keeps only the active and newest persisted versions before normalizing branches', () => {
    const messages = normalizeSessionMessages([createRawMessage('m1', {
      currentVersionIndex: 3,
      versions: Array.from({ length: 25 }, (_, index) => ({
        content: `v${index}`,
        createdAt: index,
        kind: 'original',
        subsequentMessages: [createRawMessage(`branch-${index}`)],
      })),
    })]);

    expect(messages[0]?.currentVersionIndex).toBe(0);
    expect(messages[0]?.versions.map((version) => version.content)).toEqual([
      'v3',
      ...Array.from({ length: 19 }, (_, index) => `v${index + 6}`),
    ]);
    expect(messages[0]?.versions[0]?.subsequentMessages[0]?.id).toBe('branch-3');
  });

  it('limits restored version branch messages', () => {
    const messages = normalizeSessionMessages([createRawMessage('m1', {
      versions: [{
        content: 'root',
        createdAt: 1,
        kind: 'original',
        subsequentMessages: Array.from({ length: 120 }, (_, index) =>
          createRawMessage(`branch-${index}`)
        ),
      }],
    })]);

    expect(messages[0]?.versions[0]?.subsequentMessages).toHaveLength(100);
    expect(messages[0]?.versions[0]?.subsequentMessages.at(-1)?.id).toBe('branch-99');
  });

  it('strips deeper persisted version branches', () => {
    const messages = normalizeSessionMessages([createRawMessage('root', {
      versions: [{
        content: 'root',
        createdAt: 1,
        kind: 'original',
        subsequentMessages: [createRawMessage('child', {
          versions: [{
            content: 'child',
            createdAt: 2,
            kind: 'original',
            subsequentMessages: [createRawMessage('grandchild')],
          }],
        })],
      }],
    })]);

    const child = messages[0]?.versions[0]?.subsequentMessages[0];
    expect(child?.id).toBe('child');
    expect(child?.versions[0]?.subsequentMessages).toEqual([]);
  });

  it('replaces non-finite restored message timestamps', () => {
    const now = Date.UTC(2026, 5, 7, 7, 0, 0);
    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(now);

    try {
      const messages = normalizeSessionMessages([createRawMessage('m1', {
        timestamp: Number.POSITIVE_INFINITY,
        versions: [{
          content: 'm1',
          createdAt: Number.NaN,
          kind: 'original',
          subsequentMessages: [createRawMessage('branch', {
            timestamp: Number.NEGATIVE_INFINITY,
          })],
        }],
      })]);

      expect(messages[0]?.timestamp).toBe(now);
      expect(messages[0]?.versions[0]?.createdAt).toBe(now);
      expect(messages[0]?.versions[0]?.subsequentMessages[0]?.timestamp).toBe(now);
      expect(messages[0]?.versions[0]?.subsequentMessages[0]?.versions[0]?.createdAt).toBe(now);
    } finally {
      dateNow.mockRestore();
    }
  });

  it('assigns unique ids to duplicate restored top-level messages', () => {
    const messages = normalizeSessionMessages([
      createRawMessage('duplicate', { content: 'first' }),
      createRawMessage('duplicate', { content: 'second' }),
    ]);

    expect(messages[0]?.id).toBe('duplicate');
    expect(messages[1]?.id).not.toBe('duplicate');
    expect(messages[1]?.id.startsWith('msg-')).toBe(true);
    expect(new Set(messages.map((message) => message.id))).toHaveLength(2);
  });

  it('preserves top-level ids when restored branch messages reuse them', () => {
    const messages = normalizeSessionMessages([
      createRawMessage('root', {
        versions: [{
          content: 'root',
          createdAt: 1,
          kind: 'original',
          subsequentMessages: [createRawMessage('later')],
        }],
      }),
      createRawMessage('later'),
    ]);

    const branch = messages[0]?.versions[0]?.subsequentMessages[0];
    expect(messages[1]?.id).toBe('later');
    expect(branch?.id).not.toBe('later');
    expect(branch?.id.startsWith('msg-')).toBe(true);
  });

  it('bounds restored image source caches', () => {
    const messages = normalizeSessionMessages([createRawMessage('m1', {
      imageSources: Array.from({ length: 2500 }, (_, index) => `https://example.com/${index}.png`),
    })]);

    expect(messages[0]?.imageSources).toHaveLength(1000);
    expect(messages[0]?.imageSources?.[0]).toBe('https://example.com/0.png');
    expect(messages[0]?.imageSources?.at(-1)).toBe('https://example.com/999.png');
  });
});
