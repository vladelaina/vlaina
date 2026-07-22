import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { TextSelection } from '@milkdown/kit/prose/state';
import { CODE_BLOCK_SELECTION_SYNC_EVENT } from '../code/codeBlockSelectionSync';
import { collapseSelectionAndHideFloatingToolbar } from './copyCleanup';

describe('copyCleanup', () => {
  it('notifies embedded CodeMirror node views after collapsing a copied selection', () => {
    const ownerDocument = document.implementation.createHTMLDocument('copy-cleanup');
    const dom = ownerDocument.createElement('div');
    const dispatchEventSpy = vi.spyOn(ownerDocument, 'dispatchEvent');
    const transaction = {
      setSelection: vi.fn(() => transaction),
      setMeta: vi.fn(() => transaction),
    };
    const view = {
      dom,
      state: {
        selection: {
          empty: false,
          to: 4,
        },
        doc: {
          content: { size: 10 },
          resolve: vi.fn(() => ({ pos: 4 })),
        },
        tr: transaction,
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    collapseSelectionAndHideFloatingToolbar(view as never);

    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: CODE_BLOCK_SELECTION_SYNC_EVENT,
    }));
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it('collapses a copied range at the exact hard-break line edge', async () => {
    const editor = Editor.make()
      .config((ctx) => {
        ctx.set(defaultValueCtx, 'Alpha  \nBeta');
      })
      .use(commonmark)
      .use(gfm);
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);

    try {
      let hardBreakPos: number | null = null;
      view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'hardbreak' && node.type.name !== 'hard_break') return true;
        hardBreakPos = pos;
        return false;
      });
      expect(hardBreakPos).not.toBeNull();

      view.dispatch(view.state.tr.setSelection(
        TextSelection.create(view.state.doc, 1, hardBreakPos!)
      ));
      collapseSelectionAndHideFloatingToolbar(view);

      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(hardBreakPos);
      expect(view.state.selection.to).toBe(hardBreakPos);
    } finally {
      await editor.destroy();
    }
  });
});
