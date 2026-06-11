import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Decoration } from '@milkdown/kit/prose/view';
import {
  collectTagTokenDecorationsInRange,
  MAX_TAG_TOKEN_CHANGED_CONTEXT_CHARS,
  MAX_TAG_TOKEN_EDGE_RECTS,
  resolveTagTokenEdgeOffset,
  tagTokenPlugin,
  tagTokenPluginKey,
  transactionMayAffectTagTokenDecorations,
} from './tagTokenPlugin';

interface FakeTagNode {
  child?: (index: number) => FakeTagNode | null | undefined;
  childCount?: number;
  isText?: boolean;
  nodeSize?: number;
  text?: string;
  type?: { name?: string };
}

function createTextNode(text: string): FakeTagNode {
  return {
    isText: true,
    nodeSize: text.length,
    text,
    type: { name: 'text' },
  };
}

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(tagTokenPlugin);

  await editor.create();
  return editor;
}

function findTextEndPosition(doc: any, text: string): number {
  let position = -1;
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || typeof node.text !== 'string') return true;
    const index = node.text.indexOf(text);
    if (index < 0) return true;
    position = pos + index + text.length;
    return false;
  });
  if (position < 0) {
    throw new Error(`Unable to find text: ${text}`);
  }
  return position;
}

function getTagTokenTexts(view: any): string[] {
  const decorations = tagTokenPluginKey.getState(view.state)?.find() ?? [];
  return decorations.map((decoration: Decoration) => (
    view.state.doc.textBetween(decoration.from, decoration.to)
  ));
}

function createFlatTagDoc(text: string) {
  return {
    content: { size: text.length },
    textBetween: (from: number, to: number) => text.slice(from, to),
  };
}

function createTextInsertTransaction(position: number, text: string) {
  return {
    steps: [{
      slice: {
        content: {
          size: text.length,
          textBetween: () => text,
        },
      },
    }],
    mapping: {
      maps: [{
        forEach: (callback: (
          oldStart: number,
          oldEnd: number,
          newStart: number,
          newEnd: number,
        ) => void) => {
          callback(position, position, position, position + text.length);
        },
      }],
    },
  };
}

describe('tagTokenPlugin', () => {
  it('decorates note tags without touching inline or block code', async () => {
    const editor = await createEditor([
      'Use #project and `#code`.',
      '',
      '```',
      '#block',
      '```',
    ].join('\n'));
    const view = editor.ctx.get(editorViewCtx);
    const decorations = tagTokenPluginKey.getState(view.state)?.find() ?? [];

    expect(decorations.map((decoration: Decoration) => ({
      text: view.state.doc.textBetween(decoration.from, decoration.to),
      className: (decoration.type as any).attrs?.class,
    }))).toEqual([{
      text: '#project',
      className: expect.stringContaining('editor-tag-token'),
    }]);

    await editor.destroy();
  });

  it('ignores oversized tag tokens', async () => {
    const editor = await createEditor(`#${'a'.repeat(129)} #ok`);
    const view = editor.ctx.get(editorViewCtx);
    const decorations = tagTokenPluginKey.getState(view.state)?.find() ?? [];

    expect(decorations.map((decoration: Decoration) => (
      view.state.doc.textBetween(decoration.from, decoration.to)
    ))).toEqual(['#ok']);

    await editor.destroy();
  });

  it('caps tag token decorations per document', async () => {
    const tags = Array.from({ length: 1005 }, (_, index) => `#tag${index}`).join(' ');
    const editor = await createEditor(tags);
    const view = editor.ctx.get(editorViewCtx);
    const decorations = tagTokenPluginKey.getState(view.state)?.find() ?? [];

    expect(decorations).toHaveLength(1000);

    await editor.destroy();
  });

  it('collects tag tokens through the requested local range instead of walking document children', () => {
    const child = vi.fn(() => {
      throw new Error('full document child scan should not run for local tag token updates');
    });
    const nodesBetween = vi.fn((
      from: number,
      to: number,
      callback: (node: FakeTagNode, pos: number, parent: FakeTagNode) => void,
    ) => {
      expect({ from, to }).toEqual({ from: 80, to: 120 });
      callback(
        createTextNode('use #range-tag'),
        88,
        { type: { name: 'paragraph' } },
      );
    });
    const doc = {
      child,
      content: { size: 300 },
      nodesBetween,
    };

    const decorations = collectTagTokenDecorationsInRange(doc, 80, 120);

    expect(decorations).toHaveLength(1);
    expect(nodesBetween).toHaveBeenCalledTimes(1);
    expect(child).not.toHaveBeenCalled();
  });

  it('updates only the edited paragraph when a tag token is completed character by character', async () => {
    const editor = await createEditor([
      'Use #existing for docs.',
      ...Array.from({ length: 40 }, (_, index) => `Filler paragraph ${index} keeps this note large enough.`),
      'Finish #tai',
    ].join('\n\n'));
    const view = editor.ctx.get(editorViewCtx);

    expect(getTagTokenTexts(view)).toEqual(['#existing', '#tai']);

    const insertAt = findTextEndPosition(view.state.doc, 'Finish #tai');
    view.dispatch(view.state.tr.insertText('l', insertAt, insertAt));

    expect(getTagTokenTexts(view)).toEqual(['#existing', '#tail']);

    await editor.destroy();
  });

  it('ignores plain edits far away from tag triggers in the same large text', () => {
    const farPadding = 'a'.repeat(MAX_TAG_TOKEN_CHANGED_CONTEXT_CHARS * 3);
    const text = `#existing ${farPadding} cursor`;
    const position = text.length;
    const previous = { find: vi.fn(() => []) };

    expect(transactionMayAffectTagTokenDecorations(
      previous,
      createTextInsertTransaction(position, 'x'),
      createFlatTagDoc(text),
    )).toBe(false);
  });

  it('keeps plain edits near tag triggers eligible for local tag updates', () => {
    const text = `Near #unfinished ${'a'.repeat(8)}`;
    const position = text.length;
    const previous = { find: vi.fn(() => []) };

    expect(transactionMayAffectTagTokenDecorations(
      previous,
      createTextInsertTransaction(position, 'x'),
      createFlatTagDoc(text),
    )).toBe(true);
  });

  it('resolves tag token edge offsets without materializing rect lists', () => {
    const token = document.createElement('span');
    token.append('#project');
    const rectIterator = vi.fn(() => {
      throw new Error('rects should not be iterated');
    });
    const createRangeSpy = vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => ({
        length: 1,
        item: (index: number) => index === 0
          ? ({
              left: 10,
              right: 90,
              top: 20,
              bottom: 40,
              width: 80,
              height: 20,
            } as DOMRect)
          : null,
        [Symbol.iterator]: rectIterator,
      }),
      detach: vi.fn(),
    } as unknown as Range);

    expect(resolveTagTokenEdgeOffset(token, 88, 30)).toEqual({
      textNode: token.firstChild,
      offset: '#project'.length,
    });
    expect(rectIterator).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('ignores oversized tag token rect lists without reading rect entries', () => {
    const token = document.createElement('span');
    token.append('#project');
    const item = vi.fn(() => {
      throw new Error('rect entries should not be read');
    });
    const rectIterator = vi.fn(() => {
      throw new Error('rects should not be iterated');
    });
    const createRangeSpy = vi.spyOn(document, 'createRange').mockReturnValue({
      selectNodeContents: vi.fn(),
      getClientRects: () => ({
        length: MAX_TAG_TOKEN_EDGE_RECTS + 1,
        item,
        [Symbol.iterator]: rectIterator,
      }),
      detach: vi.fn(),
    } as unknown as Range);

    expect(resolveTagTokenEdgeOffset(token, 88, 30)).toBeNull();
    expect(item).not.toHaveBeenCalled();
    expect(rectIterator).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });
});
