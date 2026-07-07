import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { PluginKey } from '@milkdown/kit/prose/state';
import {
  LIST_CONTAINER_NODE_NAMES,
  isNavigableAtomicBlockNode,
} from '../shared/blockNodeTypes';

export type Direction = 'up' | 'down';

export interface TopLevelBlock {
  from: number;
  to: number;
  node: ProseNode;
}

export interface AdjacentContainerBlock extends TopLevelBlock {
  crossesContainerBoundary: boolean;
}

export type TextSelectionEdge = 'start' | 'end';

export interface TransientGapState {
  pos: number | null;
}

export type TransientGapAction =
  | { type: 'track'; pos: number }
  | { type: 'clear' };

export const atomicBlockKeyboardNavigationPluginKey =
  new PluginKey<TransientGapState>('atomicBlockKeyboardNavigation');

export const EMPTY_TRANSIENT_GAP_STATE: TransientGapState = { pos: null };
export const ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS = 'editor-atomic-block-keyboard-selected';
export const TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES = new Set([
  'blockquote',
  'callout',
  'footnote_def',
]);

export function isNavigableAtomicBlock(node: ProseNode | null | undefined): boolean {
  return isNavigableAtomicBlockNode(node);
}

export function isListContainerNode(node: ProseNode | null | undefined): node is ProseNode {
  return Boolean(node && LIST_CONTAINER_NODE_NAMES.has(node.type.name));
}

export function isListContainerNodeName(nodeName: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(nodeName);
}

export function isHeadingNodeName(nodeName: string): boolean {
  return nodeName === 'heading';
}

export function isEmptyParagraphNode(node: ProseNode | null | undefined): boolean {
  return Boolean(node && node.type.name === 'paragraph' && node.content.size === 0);
}

export function hasAtomicBlockNodeSelection(state: EditorState): boolean {
  return state.selection instanceof NodeSelection
    && isNavigableAtomicBlock(state.selection.node);
}

export function syncAtomicBlockKeyboardSelectionClass(view: EditorView): void {
  view.dom.classList.toggle(
    ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS,
    hasAtomicBlockNodeSelection(view.state)
  );
}

export function getTrackedEmptyGap(state: EditorState): TopLevelBlock | null {
  const pluginState = atomicBlockKeyboardNavigationPluginKey.getState(state);
  if (pluginState?.pos === null || pluginState?.pos === undefined) {
    return null;
  }

  const block = findTopLevelBlockAt(state.doc, pluginState.pos);
  if (!block || block.from !== pluginState.pos || !isEmptyParagraphNode(block.node)) {
    return null;
  }

  return block;
}

export function findTopLevelBlockAt(doc: ProseNode, pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    if (found) return;
    const from = offset;
    const to = offset + node.nodeSize;
    if (pos < from || pos >= to) return;
    found = { from, to, node };
  });
  return found;
}

export function findTopLevelBlockBefore(doc: ProseNode, pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    const from = offset;
    const to = offset + node.nodeSize;
    if (to > pos) return;
    found = { from, to, node };
  });
  return found;
}

export function findTopLevelBlockAfter(doc: ProseNode, pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    if (found || offset < pos) return;
    found = { from: offset, to: offset + node.nodeSize, node };
  });
  return found;
}

export function findTopLevelBlockAwayFromDeletedEmptyParagraph(
  doc: ProseNode,
  range: { searchDir: -1 | 1 },
  blockFrom: number,
  block: ProseNode
): TopLevelBlock | null {
  const blockTo = blockFrom + block.nodeSize;
  return range.searchDir < 0
    ? findTopLevelBlockAfter(doc, blockTo)
    : findTopLevelBlockBefore(doc, blockFrom);
}

export function getAdjacentTopLevelBlock(
  doc: ProseNode,
  block: TopLevelBlock,
  direction: Direction
): TopLevelBlock | null {
  return direction === 'up'
    ? findTopLevelBlockBefore(doc, block.from)
    : findTopLevelBlockAfter(doc, block.to);
}

export function isSelectionInsideBlock(selection: EditorState['selection'], block: TopLevelBlock): boolean {
  return selection.from >= block.from && selection.to <= block.to;
}

export function isDisposableTransientGap(state: EditorState, gap: TopLevelBlock): boolean {
  const previous = findTopLevelBlockBefore(state.doc, gap.from);
  const next = findTopLevelBlockAfter(state.doc, gap.to);
  return isNavigableAtomicBlock(previous?.node) || isNavigableAtomicBlock(next?.node);
}

export function createClearTransientGapTransaction(state: EditorState): Transaction | null {
  const gap = getTrackedEmptyGap(state);
  if (!gap || !isDisposableTransientGap(state, gap)) {
    return null;
  }

  return state.tr
    .delete(gap.from, gap.to)
    .setMeta(atomicBlockKeyboardNavigationPluginKey, { type: 'clear' } satisfies TransientGapAction);
}

export function setTransientInputParagraphSelection(
  state: EditorState,
  tr: Transaction,
  insertPos: number
): Transaction | null {
  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) {
    return null;
  }

  const $insert = tr.doc.resolve(insertPos);
  const index = $insert.index(0);
  if (typeof tr.doc.canReplaceWith === 'function' && !tr.doc.canReplaceWith(index, index, paragraphType)) {
    return null;
  }

  const paragraph = paragraphType.create();
  return tr
    .insert(insertPos, paragraph)
    .setSelection(TextSelection.create(tr.doc, insertPos + 1))
    .setMeta(atomicBlockKeyboardNavigationPluginKey, { type: 'track', pos: insertPos } satisfies TransientGapAction);
}
