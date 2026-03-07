import { describe, expect, it, vi } from 'vitest';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { Serializer } from '@milkdown/kit/transformer';
import { serializeSelectedBlocksToText } from './blockSelectionCommands';

function createMockState(): EditorState {
  const doc = {
    cut(from: number, to: number) {
      return { range: `${from}-${to}` };
    },
    slice(from: number, to: number) {
      const text = `plain-${from}-${to}`;
      return {
        content: {
          forEach(callback: (node: { isText: boolean; text: string }) => void) {
            callback({ isText: true, text });
          },
        },
      };
    },
  };

  return { doc } as unknown as EditorState;
}

describe('serializeSelectedBlocksToText', () => {
  it('prefers markdown serializer and keeps markdown syntax text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => `## ${doc.range}`);

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 5, to: 8 },
        { from: 1, to: 4 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('## 1-4\n## 5-8');
    expect(markdownSerializer.mock.calls.map(([doc]) => (doc as { range: string }).range)).toEqual([
      '1-4',
      '5-8',
    ]);
  });

  it('falls back to plain text when markdown serializer throws', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => {
      throw new Error('serializer unavailable');
    });

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 2, to: 6 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('plain-2-6');
  });

  it('normalizes empty markdown block serialized as <br /> to empty text', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn(() => '<br />');

    const result = serializeSelectedBlocksToText(
      state,
      [{ from: 3, to: 4 }],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('\n');
  });

  it('keeps empty block gaps when copying multiple markdown blocks', () => {
    const state = createMockState();
    const markdownSerializer = vi.fn((doc: any) => {
      if (doc.range === '1-2') return '# Title';
      if (doc.range === '3-4') return '<br />';
      return '- item';
    });

    const result = serializeSelectedBlocksToText(
      state,
      [
        { from: 1, to: 2 },
        { from: 3, to: 4 },
        { from: 5, to: 6 },
      ],
      { markdownSerializer: markdownSerializer as unknown as Serializer },
    );

    expect(result).toBe('# Title\n\n- item');
  });
});
