import { describe, expect, it } from 'vitest';
import { serializeCalloutToMarkdown } from './calloutPlugin';

function createRecorder() {
  const calls: Array<{ method: string; args: unknown[] }> = [];

  const state = {
    openNode: (...args: unknown[]) => {
      calls.push({ method: 'openNode', args });
      return state;
    },
    addNode: (...args: unknown[]) => {
      calls.push({ method: 'addNode', args });
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

describe('callout markdown serialization', () => {
  it('preserves alignment for the first paragraph', () => {
    const { calls, state } = createRecorder();
    const firstParagraphContent = { id: 'first-paragraph-content', size: 1 };
    const headingNode = { type: { name: 'heading' }, attrs: { level: 2 }, content: null };
    const firstParagraph = {
      type: { name: 'paragraph' },
      attrs: { align: 'center' },
      content: firstParagraphContent,
    };

    serializeCalloutToMarkdown(state, {
      attrs: {
        icon: { type: 'emoji', value: '💡' },
        backgroundColor: 'yellow',
      },
      firstChild: firstParagraph,
      childCount: 2,
      child: (index: number) => [firstParagraph, headingNode][index],
      content: null,
    });

    expect(calls).toEqual([
      { method: 'openNode', args: ['blockquote'] },
      { method: 'openNode', args: ['paragraph'] },
      { method: 'addNode', args: ['text', undefined, '💡 '] },
      { method: 'next', args: [firstParagraphContent] },
      { method: 'closeNode', args: [] },
      { method: 'addNode', args: ['html', undefined, '<!--align:center-->'] },
      { method: 'next', args: [headingNode] },
      { method: 'closeNode', args: [] },
    ]);
  });

  it('adds a leading emoji paragraph when the first child is not a paragraph', () => {
    const { calls, state } = createRecorder();
    const allContent = { id: 'all-content' };
    const headingNode = { type: { name: 'heading' }, attrs: { level: 2 }, content: null };

    serializeCalloutToMarkdown(state, {
      attrs: {
        icon: { type: 'emoji', value: '💡' },
        backgroundColor: 'yellow',
      },
      firstChild: headingNode,
      childCount: 1,
      child: () => headingNode,
      content: allContent,
    });

    expect(calls).toEqual([
      { method: 'openNode', args: ['blockquote'] },
      { method: 'openNode', args: ['paragraph'] },
      { method: 'addNode', args: ['text', undefined, '💡'] },
      { method: 'closeNode', args: [] },
      { method: 'next', args: [allContent] },
      { method: 'closeNode', args: [] },
    ]);
  });
});
