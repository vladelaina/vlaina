import { Selection, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import type { BlockRect } from './blockSelectionUtils';
import { TEXT_ONLY_BLOCK_EDGE_NODE_NAMES } from '../shared/blockNodeTypes';

const INSIDE_BLOCK_TRAILING_CLICK_MIN_GAP_PX = 24;

export interface BlankAreaPlainClickAction {
  targetPos: number;
  bias: 1 | -1;
  blockFrom: number;
}

function resolveVerticalDistance(block: BlockRect, clientY: number): number {
  if (clientY < block.top) return block.top - clientY;
  if (clientY > block.bottom) return clientY - block.bottom;
  return 0;
}

function resolveHorizontalBias(block: BlockRect, clientX: number): 1 | -1 {
  const left = block.contentLeft ?? block.left;
  const right = block.contentRight ?? block.right;
  if (clientX <= left) return 1;
  if (clientX >= right) return -1;
  return clientX <= (left + right) / 2 ? 1 : -1;
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
    const overlapsCurrentBlock = distance === 0 && nearestDistance === 0;
    if (distance < nearestDistance || overlapsCurrentBlock) {
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

export function resolveInsideBlockTrailingPlainClickAction(args: {
  blockRects: readonly BlockRect[];
  clientX: number;
  clientY: number;
}): BlankAreaPlainClickAction | null {
  const { blockRects, clientX, clientY } = args;
  for (let index = 0; index < blockRects.length; index += 1) {
    const block = blockRects[index];
    if (!block.allowInsideTrailingClick) continue;
    const contentRight = block.contentRight;
    if (contentRight === undefined || clientX < contentRight + INSIDE_BLOCK_TRAILING_CLICK_MIN_GAP_PX) continue;

    const nextBlock = blockRects[index + 1];
    const bottomBoundary = nextBlock ? nextBlock.top : block.bottom;
    const isInsideBlockOrGap = clientY >= block.top && clientY <= bottomBoundary;
    if (!isInsideBlockOrGap) continue;

    return {
      targetPos: Math.max(block.from + 1, block.to - 1),
      bias: -1,
      blockFrom: block.from,
    };
  }
  return null;
}

export function applyBlankAreaPlainClickSelection(
  tr: Transaction,
  action: BlankAreaPlainClickAction,
): Transaction {
  const docEnd = tr.doc.content.size;
  const safeBlockFrom = Math.max(0, Math.min(action.blockFrom, docEnd));
  const block = tr.doc.nodeAt(safeBlockFrom);
  if (block && TEXT_ONLY_BLOCK_EDGE_NODE_NAMES.has(block.type.name)) {
    const blockEnd = Math.max(0, Math.min(safeBlockFrom + block.nodeSize, docEnd));
    const primaryPos = action.bias === 1 ? safeBlockFrom : blockEnd;
    const fallbackPos = action.bias === 1 ? blockEnd : safeBlockFrom;
    const primaryDirection = action.bias === 1 ? -1 : 1;
    const fallbackDirection = primaryDirection === 1 ? -1 : 1;
    const primarySelection = Selection.findFrom(
      tr.doc.resolve(primaryPos),
      primaryDirection,
      true
    );
    const fallbackSelection = Selection.findFrom(
      tr.doc.resolve(fallbackPos),
      fallbackDirection,
      true
    );
    const selection = primarySelection ?? fallbackSelection;
    return selection instanceof TextSelection ? tr.setSelection(selection) : tr;
  }

  const safePos = Math.max(0, Math.min(action.targetPos, docEnd));
  return tr.setSelection(Selection.near(tr.doc.resolve(safePos), action.bias));
}
