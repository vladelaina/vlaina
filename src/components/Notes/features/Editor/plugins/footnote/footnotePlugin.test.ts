import { describe, expect, it } from 'vitest';
import { serializeFootnoteDefinitionToMarkdown } from './footnotePlugin';

function createRecorder() {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const state = {
    openNode: (...args: unknown[]) => {
      calls.push({ method: 'openNode', args });
      return state;
    },
    next: (...args: unknown[]) => {
      calls.push({ method: 'next', args });
      return state;
    },
    closeNode: (...args: unknown[]) => {
      calls.push({ method: 'closeNode', args });
      return state;
    },
  };

  return { calls, state };
}

describe('footnote markdown serialization', () => {
  it('serializes footnote definitions as real footnoteDefinition nodes', () => {
    const { calls, state } = createRecorder();
    const content = { id: 'footnote-content' };

    serializeFootnoteDefinitionToMarkdown(state, {
      attrs: { id: 'note-1' },
      content,
    });

    expect(calls).toEqual([
      {
        method: 'openNode',
        args: ['footnoteDefinition', undefined, { label: 'note-1', identifier: 'note-1' }],
      },
      { method: 'next', args: [content] },
      { method: 'closeNode', args: [] },
    ]);
  });
});
