import { NodeSelection, Selection, type Transaction } from '@milkdown/kit/prose/state';
import type { BlockRect } from './blockSelectionUtils';

export interface BlankAreaPlainClickAction {
  targetPos: number;
  bias: 1 | -1;
  blockFrom: number;
}

const NODE_SELECTION_BLOCKS = new Set(['math_block', 'mermaid']);

function resolveVerticalDistance(block: BlockRect, clientY: number): number {
  if (clientY < block.top) return block.top - clientY;
  if (clientY > block.bottom) return clientY - block.bottom;
  return 0;
}

function resolveHorizontalBias(block: BlockRect, clientX: number): 1 | -1 {
  if (clientX <= block.left) return 1;
  if (clientX >= block.right) return -1;
  return clientX <= (block.left + block.right) / 2 ? 1 : -1;
}

export function resolveBlankAreaPlainClickAction(args: {
  blockRects: readonly BlockRect[];
  clientX: number;
  clientY: number;
}): BlankAreaPlainClickAction | null {
  const { blockRects, clientX, clientY } = args;
  if (blockRects.length === 0) return null;

  let nearestBlock = blockRects[0];
  let nearestDistance = resolveVerticalDistance(nearestBlock, clientY);

  for (let index = 1; index < blockRects.length; index += 1) {
    const candidate = blockRects[index];
    const distance = resolveVerticalDistance(candidate, clientY);
    if (distance < nearestDistance) {
      nearestBlock = candidate;
      nearestDistance = distance;
    }
  }

  const bias = resolveHorizontalBias(nearestBlock, clientX);
  const targetPos = bias === 1
    ? nearestBlock.from + 1
    : Math.max(nearestBlock.from + 1, nearestBlock.to - 1);

  return {
    targetPos,
    bias,
    blockFrom: nearestBlock.from,
  };
}

export function applyBlankAreaPlainClickSelection(
  tr: Transaction,
  action: BlankAreaPlainClickAction,
): Transaction {
  const docEnd = tr.doc.content.size;
  const safeBlockFrom = Math.max(0, Math.min(action.blockFrom, docEnd));
  const block = tr.doc.nodeAt(safeBlockFrom);
  if (block && NODE_SELECTION_BLOCKS.has(block.type.name)) {
    return tr.setSelection(NodeSelection.create(tr.doc, safeBlockFrom));
  }

  const safePos = Math.max(0, Math.min(action.targetPos, docEnd));
  return tr.setSelection(Selection.near(tr.doc.resolve(safePos), action.bias));
}
