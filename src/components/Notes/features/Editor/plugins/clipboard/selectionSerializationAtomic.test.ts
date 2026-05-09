import { describe, expect, it } from 'vitest';
import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { AllSelection } from '@milkdown/kit/prose/state';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';

import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { mathPlugin } from '../math';
import { calloutPlugin } from '../callout';
import { tocPlugin } from '../toc';
import { videoPlugin } from '../video';
import { highlightPlugin } from '../highlight';
import { colorMarksPlugin } from '../floating-toolbar';
import { serializeSelectionToClipboardText } from './selectionSerialization';

async function copyAllMarkdown(markdown: string, plugins: readonly any[] = []) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm);

  for (const plugin of plugins) {
    editor.use(plugin);
  }

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const serializer = editor.ctx.get(serializerCtx);
  view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
  const text = serializeSelectionToClipboardText(view.state, serializer);
  await editor.destroy();
  return text;
}

describe('selectionSerialization atomic selections', () => {
  it('copies formulas in a full document selection as math markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, ['before', '', '$$', 'x^2', '$$', '', 'after'].join('\n'));
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(mathPlugin);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe(
      ['before', '', '$$', 'x^2', '$$', '', 'after'].join('\n')
    );

    await editor.destroy();
  });

  it('copies tables in a full document selection as table markdown', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(
          defaultValueCtx,
          ['before', '', '| A | B |', '| --- | --- |', '| 1 | 2 |', '', 'after'].join('\n')
        );
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));
      })
      .use(commonmark)
      .use(gfm);

    await editor.create();

    const view = editor.ctx.get(editorViewCtx);
    const serializer = editor.ctx.get(serializerCtx);
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(serializeSelectionToClipboardText(view.state, serializer)).toBe(
      ['before', '', '| A | B |', '| - | - |', '| 1 | 2 |', '', 'after'].join('\n')
    );

    await editor.destroy();
  });

  it.each([
    {
      name: 'callout',
      markdown: ['> 💡 Tip', '>', '> Body'].join('\n'),
      plugins: [...calloutPlugin],
      expected: ['> 💡 Tip', '>', '> Body'].join('\n'),
    },
    {
      name: 'toc',
      markdown: '[TOC]',
      plugins: [...tocPlugin],
      expected: '[TOC]',
    },
    {
      name: 'video',
      markdown: '![video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
      plugins: [...videoPlugin],
      expected: '![video](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    },
    {
      name: 'custom inline marks',
      markdown: '==highlight== ++underlined++ <span style="color: #123456">red</span>',
      plugins: [...highlightPlugin, ...colorMarksPlugin],
      expected: '==highlight== ++underlined++ <span style="color: #123456">red</span>',
    },
  ])('copies $name as markdown, not editor DOM', async ({ markdown, plugins, expected }) => {
    await expect(copyAllMarkdown(markdown, plugins)).resolves.toBe(expected);
  });
});
