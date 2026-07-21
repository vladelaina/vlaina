import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import { dispatchPlainTextPayload, moveSelectionToDropPoint } from './clipboardPasteDispatch';

describe('clipboard caret positions', () => {
  it('keeps an external text drop at the exact hard-break line edge', async () => {
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
      vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: hardBreakPos!, inside: 0 });

      expect(moveSelectionToDropPoint(view, {
        clientX: 120,
        clientY: 80,
      } as DragEvent)).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(hardBreakPos);
      expect(view.state.selection.to).toBe(hardBreakPos);
    } finally {
      await editor.destroy();
    }
  });

  it('keeps the cursor at an exact textblock tail after a structural paste', async () => {
    const editor = Editor.make().use(commonmark).use(gfm);
    await editor.create();
    const view = editor.ctx.get(editorViewCtx);
    const parser = editor.ctx.get(parserCtx);
    const nearSpy = vi.spyOn(Selection, 'near');

    try {
      expect(dispatchPlainTextPayload(view, '# Pasted heading', parser)).toBe(true);
      let headingTail: number | null = null;
      view.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'heading') return true;
        headingTail = pos + 1 + node.content.size;
        return false;
      });

      expect(headingTail).not.toBeNull();
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(headingTail);
      expect(view.state.selection.to).toBe(headingTail);
      expect(nearSpy).not.toHaveBeenCalled();
    } finally {
      nearSpy.mockRestore();
      await editor.destroy();
    }
  });
});
