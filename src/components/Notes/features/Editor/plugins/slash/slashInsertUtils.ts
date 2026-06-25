import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/kit/prose/state';
import { themeDomStyleTokens } from '@/styles/themeTokens';
export {
  findInsertedNodePos,
  moveSelectionAfterInsertedNode,
} from '../shared/insertedNodeSelection';

const EDITABLE_BLANK_LINE_PLACEHOLDER_PATTERN = /[\u200B\u200C]/g;

export function getSlashInsertViewportPosition(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return {
      x: coords.left,
      y: coords.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx,
    };
  } catch {
    return {
      x: themeDomStyleTokens.editorPopupFallbackX,
      y: themeDomStyleTokens.editorPopupFallbackY,
    };
  }
}

function isEditableBlankLineText(text: string): boolean {
  return text.replace(EDITABLE_BLANK_LINE_PLACEHOLDER_PATTERN, '').trim().length === 0;
}

export function replaceSelectionOrCurrentBlankTextBlockWithNode<TNode, TTransaction>(state: {
  selection: unknown;
  tr: {
    replaceSelectionWith: (node: TNode, inheritMarks?: boolean) => TTransaction;
    replaceWith: (from: number, to: number, node: TNode) => TTransaction;
  };
}, node: TNode): TTransaction {
  const { selection } = state;
  if (
    selection instanceof TextSelection &&
    selection.empty &&
    selection.$from.depth === 1 &&
    selection.$from.parent.type.name === 'paragraph' &&
    isEditableBlankLineText(selection.$from.parent.textContent)
  ) {
    return state.tr.replaceWith(selection.$from.before(1), selection.$from.after(1), node);
  }

  return state.tr.replaceSelectionWith(node);
}
