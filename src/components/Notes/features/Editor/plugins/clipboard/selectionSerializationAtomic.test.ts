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
import { serializeSelectionToClipboardText } from './selectionSerialization';

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
});
