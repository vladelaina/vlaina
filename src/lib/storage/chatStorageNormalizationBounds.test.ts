import { describe, expect, it } from 'vitest';
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

  it('bounds restored image source caches', () => {
    const messages = normalizeSessionMessages([createRawMessage('m1', {
      imageSources: Array.from({ length: 2500 }, (_, index) => `https://example.com/${index}.png`),
    })]);

    expect(messages[0]?.imageSources).toHaveLength(1000);
    expect(messages[0]?.imageSources?.[0]).toBe('https://example.com/0.png');
    expect(messages[0]?.imageSources?.at(-1)).toBe('https://example.com/999.png');
  });
});
