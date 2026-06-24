import { NodeSelection, Selection, TextSelection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Decoration, DecorationSet, type EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import { isSameEditorScrollRoot } from './blankAreaInteractionUtils';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import { isNavigableAtomicBlockNode } from '../shared/blockNodeTypes';

export const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
export const RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE = '<!--vlaina-rendered-html-boundary-blank-line-->';
const MARKDOWN_BLANK_LINE_SELECTOR = `[data-type="html-block"][data-value="${MARKDOWN_BLANK_LINE_VALUE}"]`;
export const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';
const EDITABLE_MARKDOWN_BLANK_LINE_CLASS = 'editor-editable-markdown-blank-line';
const MARKDOWN_BLANK_LINE_DEBUG_STORAGE_KEY = 'editor-debug-markdown-blank-line';
const MAX_EDITABLE_MARKDOWN_BLANK_LINE_DECORATIONS = 1000;
export const MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
const editableMarkdownBlankLineDecorationsCache = new WeakMap<EditorState['doc'], DecorationSet>();

type Direction = 'up' | 'down' | 'left' | 'right';

interface TopLevelBlock {
  from: number;
  to: number;
  node: ProseNode;
}

export function isEditableMarkdownBlankLineNode(node: { content?: { size?: number }; textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; type?: { name?: string } }): boolean {
  return (
    node.type?.name === 'paragraph' &&
    node.content?.size === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length &&
    node.textBetween?.(0, EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length, '\0', '\0') === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
  );
}

export function isMarkdownBlankLinePlaceholderNode(node: { attrs?: { value?: unknown }; type?: { name?: string } } | null | undefined): boolean {
  return node?.type?.name === 'html_block' && node.attrs?.value === MARKDOWN_BLANK_LINE_VALUE;
}

export function isRenderedHtmlBoundaryBlankLinePlaceholderNode(node: { attrs?: { value?: unknown }; type?: { name?: string } } | null | undefined): boolean {
  return node?.type?.name === 'html_block' && node.attrs?.value === RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE;
}

export function isEditableBlankLinePlaceholderNode(node: { attrs?: { value?: unknown }; type?: { name?: string } } | null | undefined): boolean {
  return isMarkdownBlankLinePlaceholderNode(node) || isRenderedHtmlBoundaryBlankLinePlaceholderNode(node);
}

function getPlainNavigationDirection(event: KeyboardEvent): Direction | null {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'ArrowUp') return 'up';
  if (event.key === 'ArrowDown') return 'down';
  if (event.key === 'ArrowLeft') return 'left';
  if (event.key === 'ArrowRight') return 'right';
  return null;
}

function getPlainDeleteDirection(event: KeyboardEvent): -1 | 1 | null {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'Backspace') return -1;
  if (event.key === 'Delete') return 1;
  return null;
}

function findTopLevelBlockBefore(doc: EditorState['doc'], pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    const from = offset;
    const to = offset + node.nodeSize;
    if (to > pos) return;
    found = { from, to, node };
  });
  return found;
}

function findTopLevelBlockAfter(doc: EditorState['doc'], pos: number): TopLevelBlock | null {
  let found: TopLevelBlock | null = null;
  doc.forEach((node, offset) => {
    if (found || offset < pos) return;
    found = { from: offset, to: offset + node.nodeSize, node };
  });
  return found;
}

function createTextSelectionNearDocumentPosition(
  doc: EditorState['doc'],
  pos: number,
  bias: -1 | 1,
): TextSelection | null {
  let before: TextSelection | null = null;
  let after: TextSelection | null = null;

  doc.descendants((node, nodePos) => {
    if (!node.isTextblock || !node.inlineContent) return true;

    const start = nodePos + 1;
    const end = start + node.content.size;
    if (nodePos <= pos) {
      try {
        before = TextSelection.create(doc, end);
      } catch {
        before = null;
      }
    }
    if (after === null && nodePos >= pos) {
      try {
        after = TextSelection.create(doc, start);
      } catch {
        after = null;
      }
    }
    return true;
  });

  return bias < 0 ? before ?? after : after ?? before;
}

export function replaceMarkdownBlankLineWithEditableParagraph(view: EditorView, block: TopLevelBlock): boolean {
  if (!isMarkdownBlankLinePlaceholderNode(block.node)) {
    return false;
  }

  return replaceBlankLinePlaceholderWithEditableParagraph(view, block);
}

export function replaceBlankLinePlaceholderWithEditableParagraph(view: EditorView, block: TopLevelBlock): boolean {
  if (!isEditableBlankLinePlaceholderNode(block.node)) {
    return false;
  }

  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) {
    return false;
  }

  const paragraph = paragraphType.create(
    null,
    view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
  );
  let tr = view.state.tr.replaceWith(block.from, block.to, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, block.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function createEditableMarkdownBlankLineParagraph(view: EditorView): ProseNode | null {
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return null;
  return paragraphType.create(
    null,
    view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
  );
}

function replaceRangeWithEditableMarkdownBlankLine(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  const paragraph = createEditableMarkdownBlankLineParagraph(view);
  if (!paragraph) return false;

  let tr = view.state.tr.replaceWith(from, to, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function deleteRangeAndSetNearbyTextSelection(
  view: EditorView,
  from: number,
  to: number,
  bias: -1 | 1,
): boolean {
  let tr = view.state.tr.delete(from, to);
  const selection = createTextSelectionNearDocumentPosition(tr.doc, from, bias);
  if (!selection) return false;

  tr = tr
    .setSelection(selection)
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

function isEmptyTopLevelParagraphSelection(selection: TextSelection): boolean {
  return selection.empty
    && selection.$from.depth === 1
    && selection.$from.parent.type.name === 'paragraph'
    && selection.$from.parent.content.size === 0;
}

function isEditableMarkdownBlankLineSelection(selection: TextSelection): boolean {
  return selection.empty
    && selection.$from.depth === 1
    && isEditableMarkdownBlankLineNode(selection.$from.parent);
}

function createReplaceSelectedMarkdownBlankLineTransaction(
  state: EditorState,
  selection: NodeSelection,
): Transaction | null {
  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) return null;

  const paragraph = paragraphType.create(
    null,
    state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER)
  );
  let tr = state.tr.replaceWith(selection.from, selection.to, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, selection.from + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  return tr.scrollIntoView();
}

function createDeleteSelectedMarkdownBlankLineTransaction(
  state: EditorState,
  selection: NodeSelection,
): Transaction | null {
  let tr = state.tr.delete(selection.from, selection.to);
  const nextSelection = createTextSelectionNearDocumentPosition(tr.doc, selection.from, 1);
  if (!nextSelection) return null;

  tr = tr
    .setSelection(nextSelection)
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  return tr.scrollIntoView();
}

export function appendMarkdownBlankLineNodeSelectionRecoveryTransaction(
  oldState: EditorState,
  newState: EditorState,
): Transaction | null {
  const { selection } = newState;
  if (!(selection instanceof NodeSelection) || !isMarkdownBlankLinePlaceholderNode(selection.node)) {
    return null;
  }

  if (oldState.selection instanceof TextSelection) {
    if (isEditableMarkdownBlankLineSelection(oldState.selection)) {
      return createDeleteSelectedMarkdownBlankLineTransaction(newState, selection)
        ?? createReplaceSelectedMarkdownBlankLineTransaction(newState, selection);
    }
    if (isEmptyTopLevelParagraphSelection(oldState.selection)) {
      return createReplaceSelectedMarkdownBlankLineTransaction(newState, selection);
    }
  }

  if (
    oldState.selection instanceof NodeSelection &&
    isMarkdownBlankLinePlaceholderNode(oldState.selection.node)
  ) {
    return createDeleteSelectedMarkdownBlankLineTransaction(newState, selection)
      ?? createReplaceSelectedMarkdownBlankLineTransaction(newState, selection);
  }

  return createReplaceSelectedMarkdownBlankLineTransaction(newState, selection);
}

function handleSelectedMarkdownBlankLineDelete(
  view: EditorView,
  direction: -1 | 1,
): boolean {
  const { selection } = view.state;
  if (!(selection instanceof NodeSelection) || !isMarkdownBlankLinePlaceholderNode(selection.node)) {
    return false;
  }

  return deleteRangeAndSetNearbyTextSelection(view, selection.from, selection.to, direction);
}

function handleEditableMarkdownBlankLineDelete(
  view: EditorView,
  direction: -1 | 1,
): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const $from = selection.$from;
  if ($from.depth !== 1 || !isEditableMarkdownBlankLineNode($from.parent)) return false;

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  if (direction < 0 && $from.parentOffset > 0) return false;
  if (direction > 0 && $from.parentOffset < $from.parent.content.size) return false;

  const primaryAdjacent = direction < 0
    ? findTopLevelBlockBefore(view.state.doc, blockFrom)
    : findTopLevelBlockAfter(view.state.doc, blockTo);
  const adjacent = primaryAdjacent && isMarkdownBlankLinePlaceholderNode(primaryAdjacent.node)
    ? primaryAdjacent
    : direction < 0
      ? findTopLevelBlockAfter(view.state.doc, blockTo)
      : findTopLevelBlockBefore(view.state.doc, blockFrom);
  if (!adjacent || !isMarkdownBlankLinePlaceholderNode(adjacent.node)) return false;

  return deleteRangeAndSetNearbyTextSelection(view, adjacent.from, adjacent.to, direction);
}

function handleEmptyParagraphBesideMarkdownBlankLineDelete(
  view: EditorView,
  direction: -1 | 1,
): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !isEmptyTopLevelParagraphSelection(selection)) {
    return false;
  }

  const $from = selection.$from;
  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  if (direction < 0 && $from.parentOffset > 0) return false;
  if (direction > 0 && $from.parentOffset < $from.parent.content.size) return false;

  const primaryAdjacent = direction < 0
    ? findTopLevelBlockBefore(view.state.doc, blockFrom)
    : findTopLevelBlockAfter(view.state.doc, blockTo);
  const adjacent = primaryAdjacent && isMarkdownBlankLinePlaceholderNode(primaryAdjacent.node)
    ? primaryAdjacent
    : direction < 0
      ? findTopLevelBlockAfter(view.state.doc, blockTo)
      : findTopLevelBlockBefore(view.state.doc, blockFrom);
  if (!adjacent || !isMarkdownBlankLinePlaceholderNode(adjacent.node)) return false;

  const from = Math.min(blockFrom, adjacent.from);
  const to = Math.max(blockTo, adjacent.to);
  return replaceRangeWithEditableMarkdownBlankLine(view, from, to);
}

export function handleMarkdownBlankLineDeletion(view: EditorView, event: KeyboardEvent): boolean {
  const direction = getPlainDeleteDirection(event);
  if (!direction) return false;

  const handled = (
    handleSelectedMarkdownBlankLineDelete(view, direction) ||
    handleEditableMarkdownBlankLineDelete(view, direction) ||
    handleEmptyParagraphBesideMarkdownBlankLineDelete(view, direction)
  );
  if (!handled) return false;

  event.preventDefault();
  return true;
}

function isBackwardDirection(direction: Direction): boolean {
  return direction === 'up' || direction === 'left';
}

function isSelectionAtTopLevelBoundary(
  view: EditorView,
  selection: TextSelection,
  direction: Direction,
  topLevelBlock: TopLevelBlock,
): boolean {
  const { doc } = view.state;
  const boundarySelection = Selection.findFrom(
    doc.resolve(isBackwardDirection(direction) ? topLevelBlock.from : topLevelBlock.to),
    isBackwardDirection(direction) ? 1 : -1,
    true,
  );
  if (!(boundarySelection instanceof TextSelection) || !boundarySelection.empty) {
    return false;
  }

  if (selection.from === boundarySelection.from) {
    return true;
  }

  if (direction === 'left' || direction === 'right') {
    return false;
  }

  return selection.$from.parent === boundarySelection.$from.parent && Boolean(view.endOfTextblock?.(direction));
}

function resolveAdjacentMarkdownBlankLineFromTextSelection(view: EditorView, direction: Direction): TopLevelBlock | null {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return null;
  }

  const $from = selection.$from;
  if ($from.depth < 1 || !$from.parent.isTextblock) {
    return null;
  }

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  const topLevelNode = view.state.doc.nodeAt(blockFrom);
  if (!topLevelNode) {
    return null;
  }

  const topLevelBlock: TopLevelBlock = {
    from: blockFrom,
    to: blockTo,
    node: topLevelNode,
  };

  if (!isSelectionAtTopLevelBoundary(view, selection, direction, topLevelBlock)) {
    return null;
  }

  const adjacent = isBackwardDirection(direction)
    ? findTopLevelBlockBefore(view.state.doc, blockFrom)
    : findTopLevelBlockAfter(view.state.doc, blockTo);

  return adjacent && isMarkdownBlankLinePlaceholderNode(adjacent.node) ? adjacent : null;
}

function resolveAdjacentBlockFromEditableBlankLine(
  view: EditorView,
  direction: Direction,
): TopLevelBlock | null {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return null;
  }

  const $from = selection.$from;
  if ($from.depth !== 1 || !isEditableMarkdownBlankLineNode($from.parent)) {
    return null;
  }

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  return isBackwardDirection(direction)
    ? findTopLevelBlockBefore(view.state.doc, blockFrom)
    : findTopLevelBlockAfter(view.state.doc, blockTo);
}

function resolveTextSelectionInAdjacentBlock(
  view: EditorView,
  adjacent: TopLevelBlock,
  direction: Direction,
): TextSelection | null {
  if (isMarkdownBlankLinePlaceholderNode(adjacent.node)) {
    return null;
  }

  if (adjacent.node.isTextblock) {
    const cursorPos = isBackwardDirection(direction)
      ? adjacent.from + 1 + adjacent.node.content.size
      : adjacent.from + 1;
    return TextSelection.create(view.state.doc, cursorPos);
  }

  const boundaryPos = isBackwardDirection(direction) ? adjacent.to : adjacent.from;
  const resolvedPos = view.state.doc.resolve(
    Math.max(0, Math.min(boundaryPos, view.state.doc.content.size))
  );
  const adjacentSelection = Selection.findFrom(
    resolvedPos,
    isBackwardDirection(direction) ? -1 : 1,
    true,
  );
  return adjacentSelection instanceof TextSelection ? adjacentSelection : null;
}

function resolveNodeSelectionForAdjacentAtomicBlock(
  view: EditorView,
  adjacent: TopLevelBlock,
): NodeSelection | null {
  if (!isNavigableAtomicBlockNode(adjacent.node)) {
    return null;
  }

  return NodeSelection.create(view.state.doc, adjacent.from);
}

function moveSelectionOutOfEditableBlankLine(view: EditorView, direction: Direction): boolean {
  const adjacent = resolveAdjacentBlockFromEditableBlankLine(view, direction);
  if (!adjacent) {
    return false;
  }

  if (isMarkdownBlankLinePlaceholderNode(adjacent.node)) {
    return replaceMarkdownBlankLineWithEditableParagraph(view, adjacent);
  }

  const atomicSelection = resolveNodeSelectionForAdjacentAtomicBlock(view, adjacent);
  if (atomicSelection) {
    view.dispatch(
      view.state.tr
        .setSelection(atomicSelection)
        .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
        .scrollIntoView()
    );
    view.focus();
    return true;
  }

  const adjacentSelection = resolveTextSelectionInAdjacentBlock(view, adjacent, direction);
  if (!adjacentSelection) {
    return false;
  }

  view.dispatch(
    view.state.tr
      .setSelection(adjacentSelection)
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
      .scrollIntoView()
  );
  view.focus();
  return true;
}

export function handleMarkdownBlankLineKeyboardNavigation(view: EditorView, event: KeyboardEvent): boolean {
  const direction = getPlainNavigationDirection(event);
  if (!direction) {
    return false;
  }

  const { selection } = view.state;
  if (selection instanceof NodeSelection && isMarkdownBlankLinePlaceholderNode(selection.node)) {
    event.preventDefault();
    return replaceMarkdownBlankLineWithEditableParagraph(view, {
      from: selection.from,
      to: selection.to,
      node: selection.node,
    });
  }

  if (moveSelectionOutOfEditableBlankLine(view, direction)) {
    event.preventDefault();
    return true;
  }

  const adjacent = resolveAdjacentMarkdownBlankLineFromTextSelection(view, direction);
  if (!adjacent) {
    return false;
  }

  event.preventDefault();
  return replaceMarkdownBlankLineWithEditableParagraph(view, adjacent);
}

function resolveMarkdownBlankLineTarget(view: EditorView, target: EventTarget | null): HTMLElement | null {
  const targetElement = target instanceof HTMLElement
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  const blankLine = targetElement?.closest(MARKDOWN_BLANK_LINE_SELECTOR);
  return blankLine instanceof HTMLElement && view.dom.contains(blankLine) ? blankLine : null;
}

function isPointInsideMarkdownBlankLineRect(blankLine: HTMLElement, clientX: number, clientY: number): boolean {
  const rect = blankLine.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const verticalSlack = Math.max(1, Math.min(4, rect.height / 4));
  const horizontalSlack = 1;
  return (
    clientX >= rect.left - horizontalSlack &&
    clientX <= rect.right + horizontalSlack &&
    clientY >= rect.top - verticalSlack &&
    clientY <= rect.bottom + verticalSlack
  );
}

function resolveAdjacentMarkdownBlankLineTargetAtCoords(
  view: EditorView,
  target: EventTarget | null,
  clientX: number,
  clientY: number,
): HTMLElement | null {
  const targetElement = target instanceof HTMLElement
    ? target
    : target instanceof Node
      ? target.parentElement
      : null;
  if (!targetElement || !view.dom.contains(targetElement)) return null;

  let topLevelTarget: HTMLElement | null = targetElement;
  while (topLevelTarget?.parentElement && topLevelTarget.parentElement !== view.dom) {
    topLevelTarget = topLevelTarget.parentElement;
  }
  if (!topLevelTarget || topLevelTarget.parentElement !== view.dom) return null;

  const candidates = [
    topLevelTarget.previousElementSibling,
    topLevelTarget.nextElementSibling,
  ];
  for (const candidate of candidates) {
    if (
      candidate instanceof HTMLElement &&
      candidate.matches(MARKDOWN_BLANK_LINE_SELECTOR) &&
      isPointInsideMarkdownBlankLineRect(candidate, clientX, clientY)
    ) {
      return candidate;
    }
  }
  return null;
}

export function resolveMarkdownBlankLineTargetAtCoords(
  view: EditorView,
  clientX: number,
  clientY: number,
  target: EventTarget | null = null,
): HTMLElement | null {
  const adjacentBlankLine = resolveAdjacentMarkdownBlankLineTargetAtCoords(view, target, clientX, clientY);
  if (adjacentBlankLine) return adjacentBlankLine;

  let closestBlankLine: HTMLElement | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  const blankLines = view.dom.querySelectorAll(MARKDOWN_BLANK_LINE_SELECTOR);

  for (let index = 0; index < blankLines.length; index += 1) {
    const blankLine = blankLines.item(index);
    if (!(blankLine instanceof HTMLElement)) continue;

    const rect = blankLine.getBoundingClientRect();
    if (!isPointInsideMarkdownBlankLineRect(blankLine, clientX, clientY)) continue;

    const yCenter = rect.top + rect.height / 2;
    const xCenter = rect.left + rect.width / 2;
    const distance = Math.abs(clientY - yCenter) + Math.abs(clientX - xCenter) / Math.max(1, rect.width);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestBlankLine = blankLine;
    }
  }

  return closestBlankLine;
}

export function resolveMarkdownBlankLineNodePos(view: EditorView, blankLine: HTMLElement): number | null {
  try {
    const directPos = view.posAtDOM(blankLine, 0);
    const directNode = view.state.doc.nodeAt(directPos);
    if (
      directNode?.type.name === 'html_block'
      && directNode.attrs.value === MARKDOWN_BLANK_LINE_VALUE
      && view.nodeDOM(directPos) === blankLine
    ) {
      return directPos;
    }
  } catch {
    // Fall through to the document scan for custom DOM mappings.
  }

  let found: number | null = null;
  scanProseDescendants(view.state.doc, (node, pos) => {
    if (node.type?.name !== 'html_block' || node.attrs?.value !== MARKDOWN_BLANK_LINE_VALUE) {
      return true;
    }
    if (view.nodeDOM(pos) === blankLine) {
      found = pos;
      return STOP_PROSE_SCAN;
    }
    return true;
  }, MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES);
  return found;
}

export function findEditableMarkdownBlankLineElement(root: HTMLElement): HTMLParagraphElement | null {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children.item(index);
    if (
      child instanceof HTMLParagraphElement
      && child.textContent === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
    ) {
      return child;
    }
  }
  return null;
}

function isMarkdownBlankLineDebugEnabled(): boolean {
  const globalValue = globalThis as typeof globalThis & {
    __debugMarkdownBlankLine?: boolean;
    localStorage?: Pick<Storage, 'getItem'>;
  };
  if (globalValue.__debugMarkdownBlankLine === true) return true;
  try {
    return globalValue.localStorage?.getItem(MARKDOWN_BLANK_LINE_DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function logMarkdownBlankLineDebug(message: string, payload: Record<string, unknown>): void {
  if (!isMarkdownBlankLineDebugEnabled()) return;
  console.debug('[editor:markdown-blank-line]', message, payload);
}

export function handleMarkdownBlankLinePointerDown(view: EditorView, event: MouseEvent): boolean {
  if (!isSameEditorScrollRoot(view, event.target)) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;

  const blankLine = resolveMarkdownBlankLineTarget(view, event.target)
    ?? resolveMarkdownBlankLineTargetAtCoords(view, event.clientX, event.clientY, event.target);
  if (!blankLine) return false;

  const nodePos = resolveMarkdownBlankLineNodePos(view, blankLine);
  if (nodePos === null) return false;

  const node = view.state.doc.nodeAt(nodePos);
  if (!node || node.type.name !== 'html_block') return false;
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return false;

  const debugEnabled = isMarkdownBlankLineDebugEnabled();
  const beforeRect = debugEnabled ? blankLine.getBoundingClientRect() : null;
  const nextElement = debugEnabled && blankLine.nextElementSibling instanceof HTMLElement
    ? blankLine.nextElementSibling
    : null;
  const nextTopBefore = nextElement?.getBoundingClientRect().top ?? null;
  event.preventDefault();
  const paragraph = paragraphType.create(null, view.state.schema.text(EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER));
  let tr = view.state.tr.replaceWith(nodePos, nodePos + node.nodeSize, paragraph);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, nodePos + 1 + EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();

  const editableBlankLine = debugEnabled
    ? findEditableMarkdownBlankLineElement(view.dom)
    : null;
  const afterRect = editableBlankLine?.getBoundingClientRect() ?? null;
  const nextTopAfter = nextElement?.getBoundingClientRect().top ?? null;
  logMarkdownBlankLineDebug('click converted placeholder to editable paragraph', {
    nodePos,
    selectionType: view.state.selection.constructor.name,
    blankLineHeightBefore: beforeRect?.height ?? null,
    blankLineHeightAfter: afterRect?.height ?? null,
    nextTopBefore,
    nextTopAfter,
    nextTopDelta: nextTopBefore !== null && nextTopAfter !== null ? nextTopAfter - nextTopBefore : null,
  });
  return true;
}

export function handleMarkdownBlankLineTextInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  const { selection, schema } = view.state;
  if (selection instanceof NodeSelection) {
    if (selection.from !== from || selection.to !== to) return false;
    if (selection.node.type.name !== 'html_block' || selection.node.attrs.value !== MARKDOWN_BLANK_LINE_VALUE) {
      return false;
    }

    const paragraphType = schema.nodes.paragraph;
    if (!paragraphType) return false;

    const paragraph = paragraphType.create(
      null,
      text.length > 0 ? schema.text(text) : undefined
    );
    let tr = view.state.tr.replaceWith(selection.from, selection.to, paragraph);
    tr = tr
      .setSelection(TextSelection.create(tr.doc, selection.from + 1 + text.length))
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  if (!(selection instanceof TextSelection)) return false;
  if (selection.from !== from || selection.to !== to) return false;
  if (selection.$from.parent !== selection.$to.parent) return false;
  if (!isEditableMarkdownBlankLineNode(selection.$from.parent)) return false;

  const paragraphStart = selection.$from.before();
  const replaceFrom = selection.empty ? paragraphStart + 1 : selection.from;
  const replaceTo = selection.empty ? paragraphStart + 2 : selection.to;
  let tr = view.state.tr.insertText(text, replaceFrom, replaceTo);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, replaceFrom + text.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function handleFreshEmptyParagraphTextInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  const { selection, schema } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  if (selection.from !== from || selection.to !== to) return false;
  if (text.length === 0) return false;

  const $from = selection.$from;
  if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph' || $from.parent.content.size !== 0) {
    return false;
  }

  const paragraphType = schema.nodes.paragraph;
  const htmlBlockType = schema.nodes.html_block;
  if (!paragraphType || !htmlBlockType) return false;

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  const previous = findTopLevelBlockBefore(view.state.doc, blockFrom);
  const next = findTopLevelBlockAfter(view.state.doc, blockTo);
  if (!previous || !next) return false;
  if (isMarkdownBlankLinePlaceholderNode(previous.node) || isMarkdownBlankLinePlaceholderNode(next.node)) {
    return false;
  }

  const blankLine = htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE });
  const paragraph = paragraphType.create(null, schema.text(text));
  let tr = view.state.tr.replaceWith(blockFrom, blockTo, [
    blankLine,
    paragraph,
    blankLine,
  ]);
  const insertedParagraphPos = blockFrom + blankLine.nodeSize;
  tr = tr
    .setSelection(TextSelection.create(tr.doc, insertedParagraphPos + 1 + text.length))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function appendFreshEmptyParagraphInputBoundaryTransaction(
  oldState: EditorState,
  newState: EditorState,
): Transaction | null {
  const paragraphType = newState.schema.nodes.paragraph;
  const htmlBlockType = newState.schema.nodes.html_block;
  if (!paragraphType || !htmlBlockType) return null;
  if (oldState.doc.childCount !== newState.doc.childCount) return null;

  let offset = 0;
  for (let index = 0; index < newState.doc.childCount; index += 1) {
    const oldNode = oldState.doc.child(index);
    const newNode = newState.doc.child(index);
    const from = offset;
    offset += newNode.nodeSize;

    if (index === 0 || index === newState.doc.childCount - 1) continue;
    if (oldNode.type.name !== 'paragraph' || oldNode.content.size !== 0) continue;
    if (newNode.type.name !== 'paragraph' || newNode.content.size === 0) continue;

    const previous = newState.doc.child(index - 1);
    const next = newState.doc.child(index + 1);
    if (isMarkdownBlankLinePlaceholderNode(previous) || isMarkdownBlankLinePlaceholderNode(next)) {
      continue;
    }

    const blankLine = htmlBlockType.create({ value: MARKDOWN_BLANK_LINE_VALUE });
    let tr = newState.tr.replaceWith(from, from + newNode.nodeSize, [
      blankLine,
      newNode,
      blankLine,
    ]);

    if (newState.selection instanceof TextSelection) {
      const selectionInsideInsertedParagraph =
        newState.selection.from > from &&
        newState.selection.from < from + newNode.nodeSize &&
        newState.selection.to > from &&
        newState.selection.to < from + newNode.nodeSize;
      if (selectionInsideInsertedParagraph) {
        const insertedParagraphPos = from + blankLine.nodeSize;
        tr = tr.setSelection(TextSelection.create(
          tr.doc,
          insertedParagraphPos + (newState.selection.from - from),
          insertedParagraphPos + (newState.selection.to - from),
        ));
      }
    }

    return tr
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
      .scrollIntoView();
  }

  return null;
}

export function createEditableMarkdownBlankLineDecorations(doc: EditorState['doc']): DecorationSet {
  const cached = editableMarkdownBlankLineDecorationsCache.get(doc);
  if (cached) return cached;

  const decorations: Decoration[] = [];
  const childCount = typeof doc.childCount === 'number' ? doc.childCount : 0;
  let offset = 0;
  for (
    let index = 0;
    index < childCount && decorations.length < MAX_EDITABLE_MARKDOWN_BLANK_LINE_DECORATIONS;
    index += 1
  ) {
    const node = doc.child(index);
    if (isEditableMarkdownBlankLineNode(node)) {
      decorations.push(Decoration.node(offset, offset + node.nodeSize, {
        class: EDITABLE_MARKDOWN_BLANK_LINE_CLASS,
      }));
    }
    offset += node.nodeSize;
  }
  const decorationSet = decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
  editableMarkdownBlankLineDecorationsCache.set(doc, decorationSet);
  return decorationSet;
}
