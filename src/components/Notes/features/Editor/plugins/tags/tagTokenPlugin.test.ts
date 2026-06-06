import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Decoration } from '@milkdown/kit/prose/view';
import {
  MAX_TAG_TOKEN_EDGE_RECTS,
  resolveTagTokenEdgeOffset,
  tagTokenPlugin,
  tagTokenPluginKey,
} from './tagTokenPlugin';

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
