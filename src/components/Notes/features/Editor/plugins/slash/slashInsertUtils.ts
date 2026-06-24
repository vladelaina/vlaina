import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';
import { themeDomStyleTokens } from '@/styles/themeTokens';
export {
  findInsertedNodePos,
  moveSelectionAfterInsertedNode,
} from '../shared/insertedNodeSelection';

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
