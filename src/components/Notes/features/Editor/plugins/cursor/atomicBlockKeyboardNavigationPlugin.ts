import { $prose } from '@milkdown/kit/utils';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import {
  NodeSelection,
  Plugin,
  PluginKey,
  Selection,
  TextSelection,
  type EditorState,
  type Transaction,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  findAdjacentEmptyParagraphNearBlockDeleteRange,
  isNodeContentEffectivelyEmpty,
  type AdjacentEmptyParagraphDeleteRange,
} from '../shared/emptyParagraphNearBlockDeletion';
import {
  LIST_CONTAINER_NODE_NAMES,
  STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES,
  isNavigableAtomicBlockNode,
} from '../shared/blockNodeTypes';
import {
  EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
  handleMarkdownBlankLineDeletion,
  isEditableBlankLinePlaceholderNode,
  isMarkdownBlankLinePlaceholderNode,
  replaceBlankLinePlaceholderWithEditableParagraph,
} from './markdownBlankLineInteraction';

type Direction = 'up' | 'down';

interface TopLevelBlock {
  from: number;
  to: number;
  node: ProseNode;
}

interface AdjacentContainerBlock extends TopLevelBlock {
  crossesContainerBoundary: boolean;
}

type TextSelectionEdge = 'start' | 'end';

interface TransientGapState {
  pos: number | null;
}

type TransientGapAction =
  | { type: 'track'; pos: number }
  | { type: 'clear' };

type AtomicSelectionRepairSide = 'before' | 'after';

interface AtomicSelectionRepairCandidate {
  side: AtomicSelectionRepairSide;
  typeName: string;
}

export const atomicBlockKeyboardNavigationPluginKey =
  new PluginKey<TransientGapState>('atomicBlockKeyboardNavigation');

const EMPTY_TRANSIENT_GAP_STATE: TransientGapState = { pos: null };
export const ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS = 'editor-atomic-block-keyboard-selected';
const TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES = new Set([
  'blockquote',
  'callout',
  'footnote_def',
]);

function getPlainVerticalDirection(event: KeyboardEvent): Direction | null {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'ArrowUp') return 'up';
  if (event.key === 'ArrowDown') return 'down';
  return null;
}

function isNavigableAtomicBlock(node: ProseNode | null | undefined): boolean {
  return isNavigableAtomicBlockNode(node);
}

function isListContainerNode(node: ProseNode | null | undefined): node is ProseNode {
  return Boolean(node && LIST_CONTAINER_NODE_NAMES.has(node.type.name));
}

function hasAtomicBlockNodeSelection(state: EditorState): boolean {
  return state.selection instanceof NodeSelection
    && isNavigableAtomicBlock(state.selection.node);
}

function syncAtomicBlockKeyboardSelectionClass(view: EditorView): void {
  view.dom.classList.toggle(
    ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS,
    hasAtomicBlockNodeSelection(view.state)
  );
}

function isEmptyParagraphNode(node: ProseNode | null | undefined): boolean {
  return Boolean(node && node.type.name === 'paragraph' && node.content.size === 0);
}

function isStructuralGapDeleteNode(node: ProseNode | null | undefined): boolean {
  return isEmptyParagraphNode(node) || isMarkdownBlankLinePlaceholderNode(node);
}

function getTrackedEmptyGap(state: EditorState): TopLevelBlock | null {
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

function findTopLevelBlockAt(doc: ProseNode, pos: number): TopLevelBlock | null {
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

function findTopLevelBlockBefore(doc: ProseNode, pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    const from = offset;
    const to = offset + node.nodeSize;
    if (to > pos) return;
    found = { from, to, node };
  });
  return found;
}

function findTopLevelBlockAfter(doc: ProseNode, pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    if (found || offset < pos) return;
    found = { from: offset, to: offset + node.nodeSize, node };
  });
  return found;
}

function findTopLevelBlockAwayFromDeletedEmptyParagraph(
  doc: ProseNode,
  range: AdjacentEmptyParagraphDeleteRange,
  blockFrom: number,
  block: ProseNode
): TopLevelBlock | null {
  const blockTo = blockFrom + block.nodeSize;
  return range.searchDir < 0
    ? findTopLevelBlockAfter(doc, blockTo)
    : findTopLevelBlockBefore(doc, blockFrom);
}

function getAdjacentTopLevelBlock(
  doc: ProseNode,
  block: TopLevelBlock,
  direction: Direction
): TopLevelBlock | null {
  return direction === 'up'
    ? findTopLevelBlockBefore(doc, block.from)
    : findTopLevelBlockAfter(doc, block.to);
}

function isSelectionInsideBlock(selection: EditorState['selection'], block: TopLevelBlock): boolean {
  return selection.from >= block.from && selection.to <= block.to;
}

function isDisposableTransientGap(state: EditorState, gap: TopLevelBlock): boolean {
  const previous = findTopLevelBlockBefore(state.doc, gap.from);
  const next = findTopLevelBlockAfter(state.doc, gap.to);
  return isNavigableAtomicBlock(previous?.node) || isNavigableAtomicBlock(next?.node);
}

function collectAtomicSelectionRepairCandidates(state: EditorState): AtomicSelectionRepairCandidate[] {
  const { selection, doc } = state;
  if (!selection.empty) {
    return [];
  }

  const candidates: AtomicSelectionRepairCandidate[] = [];
  const selectedBlock = findTopLevelBlockAt(doc, selection.from);
  if (selectedBlock?.node.type.name === 'paragraph' && isNodeContentEffectivelyEmpty(selectedBlock.node)) {
    const previous = findTopLevelBlockBefore(doc, selectedBlock.from);
    const next = findTopLevelBlockAfter(doc, selectedBlock.to);
    if (
      previous &&
      isNavigableAtomicBlock(previous.node) &&
      (!next || next.node.type.name === 'paragraph')
    ) {
      candidates.push({ side: 'after', typeName: previous.node.type.name });
    }
    if (
      next &&
      isNavigableAtomicBlock(next.node) &&
      (!previous || previous.node.type.name === 'paragraph')
    ) {
      candidates.push({ side: 'before', typeName: next.node.type.name });
    }
    return candidates;
  }

  if (selection instanceof TextSelection && selection.$from.parent.isTextblock) {
    return [];
  }

  const cursorPos = Math.max(0, Math.min(selection.from, doc.content.size));
  const previous = findTopLevelBlockBefore(doc, cursorPos);
  const next = findTopLevelBlockAfter(doc, cursorPos);
  if (previous?.to === cursorPos && isNavigableAtomicBlock(previous.node)) {
    candidates.push({ side: 'after', typeName: previous.node.type.name });
  }
  if (next?.from === cursorPos && isNavigableAtomicBlock(next.node)) {
    candidates.push({ side: 'before', typeName: next.node.type.name });
  }

  return candidates;
}

function createAtomicSelectionRepairTransaction(
  transactions: readonly Transaction[],
  oldState: EditorState,
  newState: EditorState
): Transaction | null {
  const selectedBlock = findTopLevelBlockAt(newState.doc, newState.selection.from);
  if (
    !selectedBlock ||
    !isNavigableAtomicBlock(selectedBlock.node) ||
    newState.selection.to > selectedBlock.to
  ) {
    return null;
  }

  if (transactions.some((tr) => tr.getMeta('pointer'))) {
    return null;
  }

  const candidate = collectAtomicSelectionRepairCandidates(oldState)
    .find((repairCandidate) => repairCandidate.typeName === selectedBlock.node.type.name);
  if (!candidate) {
    return null;
  }

  const insertPos = candidate.side === 'before' ? selectedBlock.from : selectedBlock.to;
  return setTransientInputParagraphSelection(newState, newState.tr, insertPos);
}

function createClearTransientGapTransaction(state: EditorState): Transaction | null {
  const gap = getTrackedEmptyGap(state);
  if (!gap || !isDisposableTransientGap(state, gap)) {
    return null;
  }

  return state.tr
    .delete(gap.from, gap.to)
    .setMeta(atomicBlockKeyboardNavigationPluginKey, { type: 'clear' } satisfies TransientGapAction);
}

function getPlainDeleteDirection(event: KeyboardEvent): -1 | 1 | null {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'Backspace') return -1;
  if (event.key === 'Delete') return 1;
  return null;
}

function shouldPreserveParagraphAfterCodeBlockOnBackspace(view: EditorView, event: KeyboardEvent): boolean {
  if (event.isComposing || event.key !== 'Backspace') {
    return false;
  }

  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph' || $from.parentOffset !== 0) {
    return false;
  }

  const paragraphIndex = $from.index(0);
  if (paragraphIndex <= 0) {
    return false;
  }

  const previousNode = $from.node(0).child(paragraphIndex - 1);
  return previousNode.type.name === 'code_block' && $from.parent.content.size > 0;
}

function findTextSelectionFromBoundary(
  doc: ProseNode,
  pos: number,
  direction: -1 | 1
): TextSelection | null {
  const selection = Selection.findFrom(
    doc.resolve(Math.max(0, Math.min(pos, doc.content.size))),
    direction,
    true
  );
  if (!(selection instanceof TextSelection)) {
    return null;
  }

  const selectedBlock = findTopLevelBlockAt(doc, selection.from);
  if (isNavigableAtomicBlock(selectedBlock?.node)) {
    return null;
  }

  return selection;
}

function createSafeSelectionAfterStructuralGapDelete(
  state: EditorState,
  tr: Transaction,
  range: AdjacentEmptyParagraphDeleteRange,
  mappedBlockFrom: number,
  block: ProseNode
): Transaction | null {
  const blockTo = mappedBlockFrom + block.nodeSize;
  const boundaryPos = range.searchDir < 0 ? blockTo : mappedBlockFrom;
  const intoBlockDir = range.searchDir < 0 ? -1 : 1;
  const awayFromBlockDir = range.searchDir < 0 ? 1 : -1;

  const textSelection = (isNavigableAtomicBlock(block) ? null : findTextSelectionFromBoundary(tr.doc, boundaryPos, intoBlockDir))
    ?? findTextSelectionFromBoundary(tr.doc, boundaryPos, awayFromBlockDir);
  if (textSelection) {
    return tr.setSelection(textSelection);
  }

  return setTransientInputParagraphSelection(state, tr, boundaryPos);
}

function dispatchDeleteEmptyParagraphNearStructuralBlock(
  view: EditorView,
  range: AdjacentEmptyParagraphDeleteRange,
  deleteDirection: -1 | 1
) {
  let tr = view.state.tr.delete(range.from, range.to);
  const mergedOrderedList = mergeAdjacentOrderedListsAcrossDeletedGap(tr, range.from);
  if (mergedOrderedList) {
    tr = mergedOrderedList.tr;
    const selection = Selection.findFrom(
      tr.doc.resolve(Math.min(mergedOrderedList.secondListStart, tr.doc.content.size)),
      1,
      true
    ) ?? Selection.findFrom(
      tr.doc.resolve(Math.max(0, Math.min(mergedOrderedList.secondListStart, tr.doc.content.size))),
      -1,
      true
    );
    view.dispatch((selection ? tr.setSelection(selection) : tr).scrollIntoView());
    view.focus();
    return;
  }

  const mappedBlockFrom = tr.mapping.map(range.blockFrom, -1);
  const nextNode = tr.doc.nodeAt(mappedBlockFrom);

  if (nextNode && isMarkdownBlankLinePlaceholderNode(nextNode)) {
    const paragraphType = view.state.schema.nodes.paragraph;
    if (paragraphType) {
      const paragraph = paragraphType.create(
        null,
        view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
      );
      tr = tr.replaceWith(mappedBlockFrom, mappedBlockFrom + nextNode.nodeSize, paragraph);
      view.dispatch(
        tr
          .setSelection(TextSelection.create(
            tr.doc,
            mappedBlockFrom + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length
          ))
          .scrollIntoView()
      );
      view.focus();
      return;
    }
  }

  if (nextNode?.type.name === 'heading') {
    const cursorPos = range.searchDir < 0
      ? mappedBlockFrom + 1 + nextNode.content.size
      : mappedBlockFrom + 1;
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, cursorPos)).scrollIntoView());
    view.focus();
    return;
  }

  if (range.blockName === 'code_block' && nextNode?.type.name === 'code_block') {
    const blockTo = mappedBlockFrom + nextNode.nodeSize;
    const siblingBeforeCode = findTopLevelBlockBefore(tr.doc, mappedBlockFrom)?.node;
    const siblingAfterCode = tr.doc.nodeAt(blockTo);
    const adjacentSelection = range.searchDir < 0
      ? Selection.findFrom(tr.doc.resolve(blockTo), 1, true)
      : Selection.findFrom(tr.doc.resolve(mappedBlockFrom), -1, true);

    if (adjacentSelection) {
      view.dispatch(tr.setSelection(adjacentSelection).scrollIntoView());
      view.focus();
      return;
    }

    if (siblingBeforeCode || siblingAfterCode) {
      const safeSelectionTr = createSafeSelectionAfterStructuralGapDelete(
        view.state,
        tr,
        range,
        mappedBlockFrom,
        nextNode
      );
      if (safeSelectionTr) {
        view.dispatch(safeSelectionTr.scrollIntoView());
        view.focus();
        return;
      }
    }

    const paragraphType = tr.doc.type.schema.nodes.paragraph;
    if (paragraphType) {
      const insertPos = range.searchDir < 0 ? blockTo : mappedBlockFrom;
      tr.insert(insertPos, paragraphType.create());
      tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
    }

    view.dispatch(tr.scrollIntoView());
    view.focus();
    return;
  }

  if (isListContainerNode(nextNode)) {
    const blockTo = mappedBlockFrom + nextNode.nodeSize;
    const preferPreviousTextTarget = deleteDirection < 0 && range.searchDir > 0;
    const preferNextTextTarget = deleteDirection > 0 && range.searchDir < 0;
    const adjacentSelection = range.searchDir < 0
      ? Selection.findFrom(tr.doc.resolve(blockTo), preferNextTextTarget ? 1 : -1, true)
        ?? Selection.findFrom(tr.doc.resolve(blockTo), preferNextTextTarget ? -1 : 1, true)
      : Selection.findFrom(tr.doc.resolve(mappedBlockFrom), preferPreviousTextTarget ? -1 : 1, true)
        ?? Selection.findFrom(tr.doc.resolve(mappedBlockFrom), preferPreviousTextTarget ? 1 : -1, true);

    view.dispatch((adjacentSelection ? tr.setSelection(adjacentSelection) : tr).scrollIntoView());
    view.focus();
    return;
  }

  if (nextNode && TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(nextNode.type.name)) {
    const blockTo = mappedBlockFrom + nextNode.nodeSize;
    const adjacentSelection = range.searchDir < 0
      ? Selection.findFrom(tr.doc.resolve(blockTo), -1, true)
      : Selection.findFrom(tr.doc.resolve(mappedBlockFrom), 1, true);

    view.dispatch((adjacentSelection ? tr.setSelection(adjacentSelection) : tr).scrollIntoView());
    view.focus();
    return;
  }

  if (nextNode) {
    const blockTo = mappedBlockFrom + nextNode.nodeSize;
    const adjacentAwayFromBlock = findTopLevelBlockAwayFromDeletedEmptyParagraph(
      tr.doc,
      range,
      mappedBlockFrom,
      nextNode
    );
    const adjacentSelection = adjacentAwayFromBlock?.node.type.name === 'paragraph'
      ? Selection.findFrom(
        tr.doc.resolve(range.searchDir < 0 ? blockTo : mappedBlockFrom),
        range.searchDir < 0 ? 1 : -1,
        true
      )
      : null;

    if (adjacentSelection instanceof TextSelection) {
      view.dispatch(tr.setSelection(adjacentSelection).scrollIntoView());
      view.focus();
      return;
    }

    if (adjacentAwayFromBlock && isMarkdownBlankLinePlaceholderNode(adjacentAwayFromBlock.node)) {
      const paragraphType = view.state.schema.nodes.paragraph;
      if (paragraphType) {
        const paragraph = paragraphType.create(
          null,
          view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
        );
        tr = tr.replaceWith(adjacentAwayFromBlock.from, adjacentAwayFromBlock.to, paragraph);
        view.dispatch(
          tr
            .setSelection(TextSelection.create(
              tr.doc,
              adjacentAwayFromBlock.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length
            ))
            .scrollIntoView()
        );
        view.focus();
        return;
      }
    }

    const safeSelectionTr = createSafeSelectionAfterStructuralGapDelete(
      view.state,
      tr,
      range,
      mappedBlockFrom,
      nextNode
    );
    if (safeSelectionTr) {
      view.dispatch(safeSelectionTr.scrollIntoView());
      view.focus();
      return;
    }
  }

  const nextSelection = Selection.findFrom(
    tr.doc.resolve(Math.max(0, Math.min(mappedBlockFrom, tr.doc.content.size))),
    range.searchDir,
    true
  );

  view.dispatch((nextSelection instanceof TextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView());
  view.focus();
}

function mergeAdjacentOrderedListsAcrossDeletedGap(
  tr: Transaction,
  gapFrom: number
): { tr: Transaction; secondListStart: number } | null {
  const previous = findTopLevelBlockBefore(tr.doc, gapFrom);
  const next = findTopLevelBlockAfter(tr.doc, gapFrom);
  if (!previous || !next || previous.node.type.name !== 'ordered_list' || next.node.type.name !== 'ordered_list') {
    return null;
  }

  const secondListStart = previous.from + 1 + previous.node.content.size;
  const children: ProseNode[] = [];
  previous.node.forEach((child) => {
    children.push(child);
  });
  next.node.forEach((child) => {
    children.push(child);
  });
  const mergedList = previous.node.type.create(
    previous.node.attrs,
    children,
    previous.node.marks
  );

  return {
    tr: tr.replaceWith(previous.from, next.to, mergedList),
    secondListStart,
  };
}

function handleEmptyParagraphNearStructuralBlockDelete(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  const primarySearchDir = getPlainDeleteDirection(event);
  if (primarySearchDir === null) {
    return false;
  }

  const primaryRange = findAdjacentEmptyParagraphNearBlockDeleteRange(
    view.state,
    primarySearchDir,
    STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES
  );
  const fallbackSearchDir = primarySearchDir === -1 ? 1 : -1;
  const fallbackRange = primaryRange
    ? null
    : findAdjacentEmptyParagraphNearBlockDeleteRange(
      view.state,
      fallbackSearchDir,
      STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES
    );
  const oppositeRange = primaryRange
    ? findAdjacentEmptyParagraphNearBlockDeleteRange(
      view.state,
      fallbackSearchDir,
      STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES
    )
    : null;
  const range = primaryRange && oppositeRange && isHeadingNodeName(oppositeRange.blockName)
    ? oppositeRange
    : primaryRange && oppositeRange && isListContainerNodeName(primaryRange.blockName) && !isListContainerNodeName(oppositeRange.blockName)
      ? oppositeRange
      : primaryRange ?? fallbackRange;

  if (!range) {
    return false;
  }

  event.preventDefault();
  dispatchDeleteEmptyParagraphNearStructuralBlock(view, range, primarySearchDir);
  return true;
}

function handleBackspaceAtParagraphStartAfterStructuralGap(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  if (getPlainDeleteDirection(event) !== -1) {
    return false;
  }

  const { selection, doc } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if ($from.depth !== 1 || !$from.parent.isTextblock || $from.parentOffset !== 0) {
    return false;
  }

  const currentBlockFrom = $from.before(1);
  const gapBlock = findTopLevelBlockBefore(doc, currentBlockFrom);
  if (!gapBlock || !isStructuralGapDeleteNode(gapBlock.node)) {
    return false;
  }

  const structuralBlock = findTopLevelBlockBefore(doc, gapBlock.from);
  if (
    !structuralBlock ||
    !STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES.has(structuralBlock.node.type.name)
  ) {
    return false;
  }

  const range: AdjacentEmptyParagraphDeleteRange = {
    from: gapBlock.from,
    to: gapBlock.to,
    searchDir: -1,
    blockFrom: structuralBlock.from,
    blockTo: structuralBlock.to,
    blockName: structuralBlock.node.type.name,
  };

  event.preventDefault();
  dispatchDeleteEmptyParagraphNearStructuralBlock(view, range, -1);
  return true;
}

function handleDocumentBoundaryAtomicBlockDelete(view: EditorView, event: KeyboardEvent): boolean {
  if (getPlainDeleteDirection(event) === null) {
    return false;
  }

  const { selection, doc } = view.state;
  if (!selection.empty || (selection instanceof TextSelection && selection.$from.parent.isTextblock)) {
    return false;
  }

  const cursorPos = Math.max(0, Math.min(selection.from, doc.content.size));
  const blockAfter = findTopLevelBlockAfter(doc, cursorPos);
  const blockBefore = findTopLevelBlockBefore(doc, cursorPos);
  const insertPos = blockAfter?.from === cursorPos && isNavigableAtomicBlock(blockAfter.node)
    ? blockAfter.from
    : blockBefore?.to === cursorPos && isNavigableAtomicBlock(blockBefore.node)
      ? blockBefore.to
      : null;

  if (insertPos === null) {
    return false;
  }

  const tr = setTransientInputParagraphSelection(view.state, view.state.tr, insertPos);
  if (!tr) {
    return false;
  }

  event.preventDefault();
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function handleEmptyCodeBlockDelete(view: EditorView, event: KeyboardEvent): boolean {
  const deleteDirection = getPlainDeleteDirection(event);
  if (deleteDirection === null) {
    return false;
  }

  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if ($from.parent.type.name !== 'code_block' || $from.parent.content.size > 0) {
    return false;
  }

  const codeBlockFrom = $from.before($from.depth);
  const codeBlockTo = $from.after($from.depth);
  let tr = view.state.tr.delete(codeBlockFrom, codeBlockTo);
  const safePos = Math.max(0, Math.min(codeBlockFrom, tr.doc.content.size));
  const resolved = tr.doc.resolve(safePos);
  const adjacentSelection = Selection.findFrom(resolved, deleteDirection > 0 ? 1 : -1, true)
    ?? Selection.findFrom(resolved, deleteDirection > 0 ? -1 : 1, true);

  if (adjacentSelection) {
    tr = tr.setSelection(adjacentSelection);
  }

  event.preventDefault();
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function isListContainerNodeName(nodeName: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(nodeName);
}

function isHeadingNodeName(nodeName: string): boolean {
  return nodeName === 'heading';
}

function setTransientInputParagraphSelection(
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

function setTextSelectionIntoTextblock(
  tr: Transaction,
  block: TopLevelBlock,
  direction: Direction
): Transaction | null {
  if (!block.node.isTextblock) {
    return null;
  }

  const cursorPos = direction === 'up'
    ? block.from + 1 + block.node.content.size
    : block.from + 1;
  return tr.setSelection(TextSelection.create(tr.doc, cursorPos));
}

function resolveTextSelectionInsideContainerBlock(
  state: EditorState,
  block: TopLevelBlock,
  direction: Direction,
  edge: TextSelectionEdge = direction === 'up' ? 'end' : 'start'
): Selection | null {
  if (!TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(block.node.type.name)) {
    return null;
  }

  const boundaryPos = direction === 'up' ? block.to : block.from;
  const selection = Selection.findFrom(
    state.doc.resolve(Math.max(0, Math.min(boundaryPos, state.doc.content.size))),
    direction === 'up' ? -1 : 1,
    true
  );
  if (!(selection instanceof TextSelection)) {
    return selection;
  }

  return TextSelection.create(
    state.doc,
    edge === 'end' ? selection.$from.end() : selection.$from.start()
  );
}

function resolveTextSelectionAtBlockEdge(
  state: EditorState,
  block: TopLevelBlock,
  direction: Direction,
  edge: TextSelectionEdge = direction === 'up' ? 'end' : 'start'
): Selection | null {
  if (block.node.isTextblock) {
    const cursorPos = edge === 'end'
      ? block.from + 1 + block.node.content.size
      : block.from + 1;
    return TextSelection.create(state.doc, cursorPos);
  }

  return resolveTextSelectionInsideContainerBlock(state, block, direction, edge);
}

function setSelectionPastAtomicBlock(
  state: EditorState,
  tr: Transaction,
  block: TopLevelBlock,
  direction: Direction
): Transaction | null {
  if (!isNavigableAtomicBlock(block.node)) {
    return null;
  }

  const adjacent = getAdjacentTopLevelBlock(tr.doc, block, direction);
  if (!adjacent) {
    const insertPos = direction === 'up' ? block.from : block.to;
    return setTransientInputParagraphSelection(state, tr, insertPos);
  }

  const textSelectionTr = setTextSelectionIntoTextblock(tr, adjacent, direction);
  if (textSelectionTr) {
    return textSelectionTr;
  }

  if (isNavigableAtomicBlock(adjacent.node)) {
    const insertPos = direction === 'up' ? block.from : block.to;
    return setTransientInputParagraphSelection(state, tr, insertPos);
  }

  const searchPos = direction === 'up' ? block.from : block.to;
  const selection = Selection.findFrom(
    tr.doc.resolve(Math.max(0, Math.min(searchPos, tr.doc.content.size))),
    direction === 'up' ? -1 : 1,
    true
  );
  if (selection && !(selection instanceof NodeSelection && isNavigableAtomicBlock(selection.node))) {
    return tr.setSelection(selection);
  }

  const insertPos = direction === 'up' ? block.from : block.to;
  return setTransientInputParagraphSelection(state, tr, insertPos);
}

function moveSelectionPastAtomicBlock(view: EditorView, block: TopLevelBlock, direction: Direction): boolean {
  const adjacent = getAdjacentTopLevelBlock(view.state.doc, block, direction);
  if (adjacent && isEditableBlankLinePlaceholderNode(adjacent.node)) {
    return replaceBlankLinePlaceholderWithEditableParagraph(view, adjacent);
  }

  const tr = setSelectionPastAtomicBlock(view.state, view.state.tr, block, direction);
  if (!tr) {
    return false;
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function handleTrackedGapArrow(view: EditorView, direction: Direction): boolean {
  const gap = getTrackedEmptyGap(view.state);
  if (!gap || !isSelectionInsideBlock(view.state.selection, gap)) {
    return false;
  }

  const adjacent = getAdjacentTopLevelBlock(view.state.doc, gap, direction);
  if (!adjacent || !isNavigableAtomicBlock(adjacent.node)) {
    return false;
  }

  const tr = view.state.tr
    .delete(gap.from, gap.to)
    .setMeta(atomicBlockKeyboardNavigationPluginKey, { type: 'clear' } satisfies TransientGapAction);
  const mappedAdjacentFrom = tr.mapping.map(adjacent.from, -1);
  const mappedAdjacent = findTopLevelBlockAt(tr.doc, mappedAdjacentFrom);
  if (!mappedAdjacent || !isNavigableAtomicBlock(mappedAdjacent.node)) {
    return false;
  }

  const movedTr = setSelectionPastAtomicBlock(view.state, tr, mappedAdjacent, direction);
  if (!movedTr) {
    return false;
  }

  view.dispatch(movedTr.scrollIntoView());
  view.focus();
  return true;
}

function handleTextblockBoundaryArrow(view: EditorView, direction: Direction): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const $from = selection.$from;
  if ($from.depth !== 1 || !$from.parent.isTextblock) {
    return false;
  }

  const blockFrom = $from.before(1);
  const blockTo = blockFrom + $from.parent.nodeSize;
  const contentStart = blockFrom + 1;
  const contentEnd = contentStart + $from.parent.content.size;
  const atBoundary = direction === 'up'
    ? selection.from === contentStart || view.endOfTextblock?.('up')
    : selection.from === contentEnd || view.endOfTextblock?.('down');
  if (!atBoundary) {
    return false;
  }

  const adjacent = direction === 'up'
    ? findTopLevelBlockBefore(view.state.doc, blockFrom)
    : findTopLevelBlockAfter(view.state.doc, blockTo);
  if (!adjacent) {
    return false;
  }

  if (isEditableBlankLinePlaceholderNode(adjacent.node)) {
    return replaceBlankLinePlaceholderWithEditableParagraph(view, adjacent);
  }

  const containerSelection = resolveTextSelectionInsideContainerBlock(view.state, adjacent, direction);
  if (containerSelection) {
    view.dispatch(
      view.state.tr
        .setSelection(containerSelection)
        .scrollIntoView()
    );
    view.focus();
    return true;
  }

  if (!isNavigableAtomicBlock(adjacent.node)) {
    return false;
  }

  return moveSelectionPastAtomicBlock(view, adjacent, direction);
}

function isSelectionAtTextblockVerticalBoundary(
  view: EditorView,
  selection: TextSelection,
  direction: Direction
): boolean {
  const { $from } = selection;
  if (!$from.parent.isTextblock) {
    return false;
  }

  const blockFrom = $from.before($from.depth);
  const contentStart = blockFrom + 1;
  const contentEnd = contentStart + $from.parent.content.size;
  return direction === 'up'
    ? selection.from === contentStart || Boolean(view.endOfTextblock?.('up'))
    : selection.from === contentEnd || Boolean(view.endOfTextblock?.('down'));
}

function resolveAdjacentBlockInsideTextContainer(
  selection: TextSelection,
  direction: Direction
): AdjacentContainerBlock | null {
  const { $from } = selection;

  for (let blockDepth = $from.depth; blockDepth > 1; blockDepth -= 1) {
    const parentDepth = blockDepth - 1;
    const parent = $from.node(parentDepth);
    if (!TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(parent.type.name)) {
      continue;
    }

    const childIndex = $from.index(parentDepth);
    if (direction === 'up') {
      if (childIndex <= 0) {
        continue;
      }

      const node = parent.child(childIndex - 1);
      const to = $from.before(blockDepth);
      return {
        from: to - node.nodeSize,
        to,
        node,
        crossesContainerBoundary: blockDepth < $from.depth,
      };
    }

    if (childIndex >= parent.childCount - 1) {
      continue;
    }

    const node = parent.child(childIndex + 1);
    const from = $from.after(blockDepth);
    return {
      from,
      to: from + node.nodeSize,
      node,
      crossesContainerBoundary: blockDepth < $from.depth,
    };
  }

  return null;
}

function handleTextContainerSiblingArrow(view: EditorView, direction: Direction): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  if (!isSelectionAtTextblockVerticalBoundary(view, selection, direction)) {
    return false;
  }

  const adjacent = resolveAdjacentBlockInsideTextContainer(selection, direction);
  if (!adjacent) {
    return false;
  }

  if (isEditableBlankLinePlaceholderNode(adjacent.node)) {
    return replaceBlankLinePlaceholderWithEditableParagraph(view, adjacent);
  }

  if (
    !adjacent.crossesContainerBoundary &&
    !TEXT_CONTAINER_STRUCTURAL_BLOCK_NODE_NAMES.has(adjacent.node.type.name)
  ) {
    return false;
  }

  const adjacentSelection = resolveTextSelectionAtBlockEdge(view.state, adjacent, direction, 'end');
  if (!adjacentSelection) {
    return false;
  }

  view.dispatch(
    view.state.tr
      .setSelection(adjacentSelection)
      .scrollIntoView()
  );
  view.focus();
  return true;
}

function handleAtomicBlockSelectionArrow(view: EditorView, direction: Direction): boolean {
  const { selection } = view.state;
  if (!(selection instanceof NodeSelection) || !isNavigableAtomicBlock(selection.node)) {
    return false;
  }

  const current = findTopLevelBlockAt(view.state.doc, selection.from);
  if (!current || current.from !== selection.from) {
    return false;
  }

  return moveSelectionPastAtomicBlock(view, current, direction);
}

export function handleAtomicBlockKeyboardNavigation(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  const direction = getPlainVerticalDirection(event);
  if (!direction) {
    return false;
  }

  const handled =
    handleTrackedGapArrow(view, direction)
    || handleAtomicBlockSelectionArrow(view, direction)
    || handleTextContainerSiblingArrow(view, direction)
    || handleTextblockBoundaryArrow(view, direction);

  if (handled) {
    event.preventDefault();
  }

  return handled;
}

export const atomicBlockKeyboardNavigationPlugin = $prose(() => {
  return new Plugin<TransientGapState>({
    key: atomicBlockKeyboardNavigationPluginKey,
    state: {
      init() {
        return EMPTY_TRANSIENT_GAP_STATE;
      },
      apply(tr, pluginState) {
        const action = tr.getMeta(atomicBlockKeyboardNavigationPluginKey) as TransientGapAction | undefined;
        if (action?.type === 'clear') {
          return EMPTY_TRANSIENT_GAP_STATE;
        }
        if (action?.type === 'track') {
          return { pos: action.pos };
        }
        if (pluginState.pos === null) {
          return pluginState;
        }

        if (!tr.docChanged) {
          return pluginState;
        }

        const mappedPos = tr.mapping.map(pluginState.pos, 1);
        const mappedNode = tr.doc.nodeAt(mappedPos);
        if (!isEmptyParagraphNode(mappedNode)) {
          return EMPTY_TRANSIENT_GAP_STATE;
        }

        return { pos: mappedPos };
      },
    },
    appendTransaction(transactions, oldState, newState) {
      const repairedAtomicSelection = createAtomicSelectionRepairTransaction(transactions, oldState, newState);
      if (repairedAtomicSelection) {
        return repairedAtomicSelection;
      }

      const gap = getTrackedEmptyGap(newState);
      if (!gap || isSelectionInsideBlock(newState.selection, gap)) {
        return null;
      }

      return createClearTransientGapTransaction(newState);
    },
    props: {
      handleKeyDown(view, event) {
        if (handleMarkdownBlankLineDeletion(view, event)) {
          return true;
        }

        if (shouldPreserveParagraphAfterCodeBlockOnBackspace(view, event)) {
          event.preventDefault();
          return true;
        }

        if (handleDocumentBoundaryAtomicBlockDelete(view, event)) {
          return true;
        }

        if (handleEmptyParagraphNearStructuralBlockDelete(view, event)) {
          return true;
        }

        if (handleBackspaceAtParagraphStartAfterStructuralGap(view, event)) {
          return true;
        }

        if (handleEmptyCodeBlockDelete(view, event)) {
          return true;
        }

        return handleAtomicBlockKeyboardNavigation(view, event);
      },
    },
    view(view) {
      const doc = view.dom.ownerDocument;
      let cleanupTimer: number | null = null;
      syncAtomicBlockKeyboardSelectionClass(view);

      const cleanupGapIfClickLeavesIt = () => {
        cleanupTimer = null;
        const gap = getTrackedEmptyGap(view.state);
        if (!gap || isSelectionInsideBlock(view.state.selection, gap)) {
          return;
        }

        const tr = createClearTransientGapTransaction(view.state);
        if (tr) {
          view.dispatch(tr);
        }
      };

      const handleDocumentMouseDown = () => {
        if (cleanupTimer !== null && typeof window !== 'undefined') {
          window.clearTimeout(cleanupTimer);
        }

        if (typeof window === 'undefined') {
          cleanupGapIfClickLeavesIt();
          return;
        }

        cleanupTimer = window.setTimeout(cleanupGapIfClickLeavesIt, 0);
      };

      doc.addEventListener('mousedown', handleDocumentMouseDown, true);

      return {
        update(updatedView) {
          syncAtomicBlockKeyboardSelectionClass(updatedView);
        },
        destroy() {
          doc.removeEventListener('mousedown', handleDocumentMouseDown, true);
          if (cleanupTimer !== null && typeof window !== 'undefined') {
            window.clearTimeout(cleanupTimer);
          }
          view.dom.classList.remove(ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS);
        },
      };
    },
  });
});
