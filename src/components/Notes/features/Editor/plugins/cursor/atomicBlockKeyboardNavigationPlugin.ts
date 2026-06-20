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
  type AdjacentEmptyParagraphDeleteRange,
} from '../shared/emptyParagraphNearBlockDeletion';
import {
  LIST_CONTAINER_NODE_NAMES,
  NAVIGABLE_ATOMIC_BLOCK_NODE_NAMES,
  STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES,
} from '../shared/blockNodeTypes';
import {
  EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER,
  isMarkdownBlankLinePlaceholderNode,
  replaceMarkdownBlankLineWithEditableParagraph,
} from './markdownBlankLineInteraction';

type Direction = 'up' | 'down';

interface TopLevelBlock {
  from: number;
  to: number;
  node: ProseNode;
}

interface TransientGapState {
  pos: number | null;
}

type TransientGapAction =
  | { type: 'track'; pos: number }
  | { type: 'clear' };

export const atomicBlockKeyboardNavigationPluginKey =
  new PluginKey<TransientGapState>('atomicBlockKeyboardNavigation');

const EMPTY_TRANSIENT_GAP_STATE: TransientGapState = { pos: null };
export const ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS = 'editor-atomic-block-keyboard-selected';
const NON_NAVIGABLE_HTML_BLOCK_VALUES = new Set<unknown>([
  '<!--vlaina-markdown-tight-heading-->',
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
  if (!node || !NAVIGABLE_ATOMIC_BLOCK_NODE_NAMES.has(node.type.name)) {
    return false;
  }

  if (isMarkdownBlankLinePlaceholderNode(node)) {
    return false;
  }

  if (node.type.name === 'html_block' && NON_NAVIGABLE_HTML_BLOCK_VALUES.has(node.attrs?.value)) {
    return false;
  }

  return true;
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
  if (event.key !== 'Backspace') {
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
    const hasListAcrossCode = range.searchDir < 0
      ? isListContainerNode(siblingAfterCode)
      : isListContainerNode(siblingBeforeCode);
    if (hasListAcrossCode) {
      view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, mappedBlockFrom)).scrollIntoView());
      view.focus();
      return;
    }

    const adjacentSelection = range.searchDir < 0
      ? Selection.findFrom(tr.doc.resolve(blockTo), 1, true)
      : Selection.findFrom(tr.doc.resolve(mappedBlockFrom), -1, true);

    if (adjacentSelection) {
      view.dispatch(tr.setSelection(adjacentSelection).scrollIntoView());
      view.focus();
      return;
    }

    if (siblingBeforeCode || siblingAfterCode) {
      view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, mappedBlockFrom)).scrollIntoView());
      view.focus();
      return;
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

  const nextSelection = nextNode?.type.name === range.blockName
    ? NodeSelection.create(tr.doc, mappedBlockFrom)
    : Selection.findFrom(tr.doc.resolve(Math.max(0, Math.min(mappedBlockFrom, tr.doc.content.size))), range.searchDir, true);

  view.dispatch((nextSelection ? tr.setSelection(nextSelection) : tr).scrollIntoView());
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
  if (adjacent && isMarkdownBlankLinePlaceholderNode(adjacent.node)) {
    return replaceMarkdownBlankLineWithEditableParagraph(view, adjacent);
  }

  const tr = setSelectionPastAtomicBlock(view.state, view.state.tr, block, direction);
  if (!tr) {
    return false;
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function selectAtomicBlockFromTextBoundary(view: EditorView, block: TopLevelBlock): boolean {
  view.dispatch(
    view.state.tr
      .setSelection(NodeSelection.create(view.state.doc, block.from))
      .scrollIntoView()
  );
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

  if (isMarkdownBlankLinePlaceholderNode(adjacent.node)) {
    return replaceMarkdownBlankLineWithEditableParagraph(view, adjacent);
  }

  if (!isNavigableAtomicBlock(adjacent.node)) {
    return false;
  }

  return selectAtomicBlockFromTextBoundary(view, adjacent);
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
    appendTransaction(_transactions, _oldState, newState) {
      const gap = getTrackedEmptyGap(newState);
      if (!gap || isSelectionInsideBlock(newState.selection, gap)) {
        return null;
      }

      return createClearTransientGapTransaction(newState);
    },
    props: {
      handleKeyDown(view, event) {
        if (shouldPreserveParagraphAfterCodeBlockOnBackspace(view, event)) {
          event.preventDefault();
          return true;
        }

        if (handleEmptyParagraphNearStructuralBlockDelete(view, event)) {
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
