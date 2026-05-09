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
const ATOMIC_NAV_BLOCK_NODE_NAMES = new Set(['math_block', 'mermaid']);
const STRUCTURAL_EMPTY_PARAGRAPH_DELETE_BLOCK_NAMES = new Set([
  'heading',
  'blockquote',
  'callout',
  'frontmatter',
  'footnote_def',
  'hr',
  'html_block',
  'table',
  'toc',
  'video',
  'math_block',
  'mermaid',
  'code_block',
  'ordered_list',
  'bullet_list',
]);
export const ATOMIC_BLOCK_KEYBOARD_SELECTION_CLASS = 'vlaina-atomic-block-keyboard-selected';

function getPlainVerticalDirection(event: KeyboardEvent): Direction | null {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'ArrowUp') return 'up';
  if (event.key === 'ArrowDown') return 'down';
  return null;
}

function isNavigableAtomicBlock(node: ProseNode | null | undefined): boolean {
  return Boolean(node && ATOMIC_NAV_BLOCK_NODE_NAMES.has(node.type.name));
}

function isListContainerNode(node: ProseNode | null | undefined): node is ProseNode {
  return Boolean(node && (node.type.name === 'ordered_list' || node.type.name === 'bullet_list'));
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
  range: AdjacentEmptyParagraphDeleteRange
) {
  const tr = view.state.tr.delete(range.from, range.to);
  const mappedBlockFrom = tr.mapping.map(range.blockFrom, -1);
  const nextNode = tr.doc.nodeAt(mappedBlockFrom);

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
    const adjacentSelection = range.searchDir < 0
      ? Selection.findFrom(tr.doc.resolve(blockTo), -1, true)
      : Selection.findFrom(tr.doc.resolve(mappedBlockFrom), 1, true);

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
  const range = primaryRange && oppositeRange && isListContainerNodeName(primaryRange.blockName) && !isListContainerNodeName(oppositeRange.blockName)
    ? oppositeRange
    : primaryRange ?? fallbackRange;

  if (!range) {
    return false;
  }

  event.preventDefault();
  dispatchDeleteEmptyParagraphNearStructuralBlock(view, range);
  return true;
}

function isListContainerNodeName(nodeName: string): boolean {
  return nodeName === 'ordered_list' || nodeName === 'bullet_list';
}

function selectAtomicBlock(view: EditorView, pos: number): boolean {
  view.dispatch(
    view.state.tr
      .setSelection(NodeSelection.create(view.state.doc, pos))
      .scrollIntoView()
  );
  view.focus();
  return true;
}

function moveSelectionIntoTextblock(view: EditorView, block: TopLevelBlock, direction: Direction): boolean {
  if (!block.node.isTextblock) {
    return false;
  }

  const cursorPos = direction === 'up'
    ? block.from + 1 + block.node.content.size
    : block.from + 1;
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, cursorPos))
      .scrollIntoView()
  );
  view.focus();
  return true;
}

function insertTransientInputParagraph(
  view: EditorView,
  insertPos: number
): boolean {
  const { state } = view;
  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) {
    return false;
  }

  const $insert = state.doc.resolve(insertPos);
  const index = $insert.index(0);
  if (typeof state.doc.canReplaceWith === 'function' && !state.doc.canReplaceWith(index, index, paragraphType)) {
    return false;
  }

  const paragraph = paragraphType.create();
  const tr = state.tr.insert(insertPos, paragraph);
  tr
    .setSelection(TextSelection.create(tr.doc, insertPos + 1))
    .setMeta(atomicBlockKeyboardNavigationPluginKey, { type: 'track', pos: insertPos } satisfies TransientGapAction)
    .scrollIntoView();
  view.dispatch(tr);
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
  const selectPos = direction === 'up' ? adjacent.from : gap.from;
  tr.setSelection(NodeSelection.create(tr.doc, selectPos)).scrollIntoView();
  view.dispatch(tr);
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
  if (!adjacent || !isNavigableAtomicBlock(adjacent.node)) {
    return false;
  }

  return selectAtomicBlock(view, adjacent.from);
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

  const adjacent = getAdjacentTopLevelBlock(view.state.doc, current, direction);
  if (!adjacent) {
    const insertPos = direction === 'up' ? current.from : current.to;
    return insertTransientInputParagraph(view, insertPos);
  }

  if (isNavigableAtomicBlock(adjacent.node)) {
    const insertPos = direction === 'up' ? current.from : current.to;
    return insertTransientInputParagraph(view, insertPos);
  }

  return moveSelectionIntoTextblock(view, adjacent, direction);
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
