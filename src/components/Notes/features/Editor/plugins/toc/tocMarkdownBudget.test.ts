import { describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { configureTheme } from '../../theme';
import { highlightPlugin } from '../highlight';
import { tocPlugin } from './tocPlugin';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(configureTheme);

  for (const plugin of highlightPlugin) {
    editor.use(plugin);
  }
  for (const plugin of tocPlugin) {
    editor.use(plugin);
  }

  await editor.create();
  return editor;
}

function countTocNodes(doc: { descendants: (callback: (node: { type: { name: string } }) => boolean | void) => void }) {
  let count = 0;
  doc.descendants((node) => {
    if (node.type.name === 'toc') {
      count += 1;
    }
  });
  return count;
}

describe('toc markdown budget', () => {
  it('does not let schema parsing bypass the generated TOC block cap', async () => {
    const editor = await createEditor([
      ...Array.from({ length: 10 }, () => '[TOC]'),
      '',
      '# Heading',
    ].join('\n\n'));
    const view = editor.ctx.get(editorViewCtx);

    expect(countTocNodes(view.state.doc)).toBe(8);

    await editor.destroy();
  });
});
