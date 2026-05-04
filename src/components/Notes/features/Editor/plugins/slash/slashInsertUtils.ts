import type { Ctx } from '@milkdown/kit/ctx';
import { editorViewCtx } from '@milkdown/kit/core';

export function getSlashInsertViewportPosition(ctx: Ctx) {
  const view = ctx.get(editorViewCtx);
  try {
    const coords = view.coordsAtPos(view.state.selection.from);
    return {
      x: coords.left,
      y: coords.bottom + 8,
    };
  } catch {
    return {
      x: 16,
      y: 16,
    };
  }
}

export function findInsertedNodePos(args: {
  doc: { content: { size: number }; nodesBetween: (...args: any[]) => void; nodeAt: (pos: number) => any };
  preferredPos: number;
  nodeTypeName: string;
}) {
  const { doc, preferredPos, nodeTypeName } = args;
  const directNode = doc.nodeAt(preferredPos);
  if (directNode?.type?.name === nodeTypeName) {
    return preferredPos;
  }

  let nodePos = -1;
  const from = Math.max(0, preferredPos - 2);
  const to = Math.min(doc.content.size, preferredPos + 4);
  doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (nodePos >= 0) return false;
    if (node.type?.name === nodeTypeName) {
      nodePos = pos;
      return false;
    }
    return undefined;
  });

  return nodePos >= 0 ? nodePos : preferredPos;
}
