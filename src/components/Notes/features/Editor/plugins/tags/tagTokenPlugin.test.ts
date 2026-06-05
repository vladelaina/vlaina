import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import type { Decoration } from '@milkdown/kit/prose/view';
import { tagTokenPlugin, tagTokenPluginKey } from './tagTokenPlugin';

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
});
