import { describe, expect, it, vi } from 'vitest';
import {
  MAX_PLAIN_TEXT_LINE_BREAK_PASTE_LINES,
  MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS,
  MAX_MARKDOWN_PASTE_TOP_LEVEL_NODES,
  collectMarkdownPasteTopLevelNodes,
  createPlainParagraphNodesFromText,
  createPlainTextLineBreakSlice,
  replaceInlineFootnoteReferencesInNodes,
} from './clipboardPlugin';
import { MAX_CLIPBOARD_SERIALIZATION_DEPTH } from './clipboardTraversalBudget';

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

  it('keeps parsed markdown nodes when inline footnote replacement exceeds traversal depth', () => {
    const textNode = {
      isText: true,
      marks: [],
      text: 'deep[^note]',
      type: { name: 'text', spec: {} },
    };
    let node: any = textNode;
    for (let index = 0; index <= MAX_CLIPBOARD_SERIALIZATION_DEPTH; index += 1) {
      const child = node;
      node = {
        content: {
          childCount: 1,
          forEach(callback: (childNode: unknown) => void) {
            callback(child);
          },
        },
        isLeaf: false,
        isText: false,
        type: { name: 'paragraph', spec: {} },
      };
    }

    const text = vi.fn((value: string) => ({ text: value }));
    const createFootnote = vi.fn((attrs: { label: string }) => ({ attrs, type: { name: 'footnote_reference' } }));

    const result = replaceInlineFootnoteReferencesInNodes({
      schema: {
        text,
        nodes: {
          footnote_reference: { create: createFootnote },
        },
      },
    } as never, [node]);

    expect(result).toEqual([node]);
    expect(text).not.toHaveBeenCalled();
    expect(createFootnote).not.toHaveBeenCalled();
  });

  it('rejects plain text hardbreak slices with too many lines', () => {
    const text = vi.fn((value: string) => ({ text: value }));
    const createHardbreak = vi.fn(() => ({ type: { name: 'hardbreak' } }));
    const createParagraph = vi.fn((_attrs?: unknown, content?: unknown) => ({ content, type: { name: 'paragraph' } }));

    const result = createPlainTextLineBreakSlice({
      schema: {
        text,
        nodes: {
          hardbreak: { create: createHardbreak },
          paragraph: { create: createParagraph },
        },
      },
    } as never, Array.from({ length: MAX_PLAIN_TEXT_LINE_BREAK_PASTE_LINES + 1 }, () => 'x').join('\n'));

    expect(result).toBeNull();
    expect(text).not.toHaveBeenCalled();
    expect(createHardbreak).not.toHaveBeenCalled();
    expect(createParagraph).not.toHaveBeenCalled();
  });

  it('rejects plain paragraph paste with too many blank-line blocks', () => {
    const text = vi.fn((value: string) => ({ text: value }));
    const createParagraph = vi.fn((_attrs?: unknown, content?: unknown) => ({ content, type: { name: 'paragraph' } }));

    const result = createPlainParagraphNodesFromText({
      schema: {
        text,
        nodes: {
          paragraph: { create: createParagraph },
        },
      },
    } as never, Array.from({ length: MAX_PLAIN_TEXT_PARAGRAPH_PASTE_BLOCKS + 1 }, () => 'x').join('\n\n'));

    expect(result).toBeNull();
    expect(text).not.toHaveBeenCalled();
    expect(createParagraph).not.toHaveBeenCalled();
  });
});
