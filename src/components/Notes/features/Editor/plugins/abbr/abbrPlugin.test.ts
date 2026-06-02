import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Decoration } from '@milkdown/kit/prose/view';
import { configureTheme } from '../../theme';
import { abbrPlugin, abbrPluginKey } from './abbrPlugin';

describe('abbrPlugin', () => {
  it('decorates ordinary abbreviation usage without touching definitions or code', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, [
          '*[HTML]: HyperText Markup Language',
          '',
          'HTML and `HTML`.',
          '',
          '```',
          'HTML',
          '```',
        ].join('\n'));
      })
      .use(commonmark);

    for (const plugin of abbrPlugin) {
      editor.use(plugin);
    }

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const decorations = abbrPluginKey.getState(view.state)?.find() ?? [];

    expect(decorations.map((decoration: Decoration) => ({
      text: view.state.doc.textBetween(decoration.from, decoration.to),
      title: (decoration.type as any).attrs?.title,
    }))).toEqual([{
      text: 'HTML',
      title: 'HyperText Markup Language',
    }]);

    await editor.destroy();
  });

  it('ignores escaped abbreviation definition paragraphs', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, '');
      })
      .use(commonmark)
      .use(gfm)
      .use(configureTheme);

    for (const plugin of abbrPlugin) {
      editor.use(plugin);
    }

    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const { schema } = view.state;
    const escapedDefinition = schema.nodes.paragraph.create(
      { vlainaEscapedBlockSyntax: 'abbrDefinition' },
      schema.text('*[HTML]: HyperText Markup Language')
    );
    const usage = schema.nodes.paragraph.create(null, schema.text('HTML usage'));

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [escapedDefinition, usage]));

    const decorations = abbrPluginKey.getState(view.state)?.find() ?? [];
    expect(decorations).toEqual([]);

    await editor.destroy();
  });
});
