import { describe, expect, it, vi } from 'vitest';
import {
  MAX_MARKDOWN_PASTE_TOP_LEVEL_NODES,
  collectMarkdownPasteTopLevelNodes,
} from './clipboardPlugin';

function createParsedDoc(childCount: number) {
  const nodes = Array.from({ length: Math.min(childCount, 3) }, (_value, index) => ({
    attrs: {},
    marks: [],
    nodeSize: 1,
    textContent: `node-${index}`,
    type: { name: 'paragraph' },
  }));

  return {
    content: {
      childCount,
      forEach: vi.fn((callback: (node: unknown) => void) => {
        nodes.forEach(callback);
      }),
    },
  };
}

describe('clipboard markdown paste bounds', () => {
  it('collects bounded parsed markdown top-level nodes', () => {
    const parsedDoc = createParsedDoc(2);

    expect(collectMarkdownPasteTopLevelNodes(parsedDoc as never)).toHaveLength(2);
    expect(parsedDoc.content.forEach).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized parsed markdown top-level node lists before iterating', () => {
    const parsedDoc = createParsedDoc(MAX_MARKDOWN_PASTE_TOP_LEVEL_NODES + 1);

    expect(collectMarkdownPasteTopLevelNodes(parsedDoc as never)).toBeNull();
    expect(parsedDoc.content.forEach).not.toHaveBeenCalled();
  });
});
