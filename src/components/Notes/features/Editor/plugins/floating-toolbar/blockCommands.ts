import { lift, wrapIn } from '@milkdown/kit/prose/commands';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType, TextAlignment } from './types';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';
import { normalizeCodeBlockLanguage } from '../code/codeBlockLanguage';
import { getBlockSelectionPluginState, hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { normalizeTopLevelBlockPos } from '../cursor/topLevelBlockDom';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';
import { markEditorUserInput } from '../shared/userInputEvents';
import { guessLanguage, MAX_LANGUAGE_DETECTION_CODE_CHARS } from '../../utils/languageDetection';
import {
  convertToList,
  convertToTextBlock,
  normalizeCurrentBlockToParagraph,
} from './blockTypeConversion';

export const MAX_BLOCK_COMMAND_DOM_SELECTION_CHILDREN = 5_000;
export const MAX_BLOCK_COMMAND_SELECTION_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_BLOCK_COMMAND_NODE_UPDATES = 5_000;
export const MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS = 1024 * 1024;

type TraversableNode = {
  attrs?: Record<string, unknown>;
  child?: (index: number) => TraversableNode;
  childCount?: number;
  nodeSize?: number;
  type?: { name: string };
};

function isTraversableNode(value: unknown): value is TraversableNode {
  const node = value as TraversableNode | null | undefined;
  return typeof node?.child === 'function' && typeof node.childCount === 'number';
}

function getNodeSize(node: TraversableNode): number {
  return typeof node.nodeSize === 'number' && Number.isFinite(node.nodeSize) && node.nodeSize > 0
    ? Math.floor(node.nodeSize)
    : 1;
}

function forEachBoundedSelectedNode(
  doc: unknown,
  from: number,
  to: number,
  visit: (node: TraversableNode, pos: number, parent?: TraversableNode) => boolean | void,
  maxScanNodes = MAX_BLOCK_COMMAND_SELECTION_SCAN_NODES
) {
  if (!isTraversableNode(doc)) {
    let scanned = 0;
    (doc as { nodesBetween?: (...args: any[]) => void }).nodesBetween?.(from, to, (node: TraversableNode, pos: number, parent?: TraversableNode) => {
      if (scanned >= maxScanNodes) return false;
      scanned += 1;
      return visit(node, pos, parent);
    });
    return;
  }

  let scanned = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: TraversableNode;
    offset: number;
    parent?: TraversableNode;
  }> = [{
    contentStart: 0,
    index: 0,
    node: doc,
    offset: 0,
  }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= (frame.node.childCount ?? 0)) {
      stack.pop();
      continue;
    }
    if (scanned >= maxScanNodes) {
      return;
    }

    const node = frame.node.child!(frame.index);
    const pos = frame.contentStart + frame.offset;
    const nodeSize = getNodeSize(node);
    frame.index += 1;
    frame.offset += nodeSize;

    if (pos >= to) {
      frame.index = frame.node.childCount ?? frame.index;
      continue;
    }
    if (pos + nodeSize <= from) {
      continue;
    }

    scanned += 1;
    const shouldDescend = visit(node, pos, frame.node);
    if (shouldDescend === false || !isTraversableNode(node) || (node.childCount ?? 0) === 0) {
      continue;
    }

    stack.push({
      contentStart: pos + 1,
      index: 0,
      node,
      offset: 0,
      parent: frame.node,
    });
  }
}

function getHeadingLevel(blockType: BlockType): number | null {
  if (!blockType.startsWith('heading')) {
    return null;
  }

  const level = Number.parseInt(blockType.replace('heading', ''), 10);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
}

export function getSelectedCodeBlockSourceText(view: EditorView): string | null {
  const { state } = view;
  const { from, to, empty, $from } = state.selection;
  if (!empty && to > from && typeof state.doc?.textBetween === 'function') {
    if (to - from > MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS) {
      return null;
    }
    return state.doc.textBetween(from, to, '\n', '\n').trim();
  }

  const parentSize = typeof $from.parent?.content?.size === 'number'
    ? $from.parent.content.size
    : typeof $from.parent?.textContent === 'string'
      ? $from.parent.textContent.length
      : 0;
  if (parentSize > MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS) {
    return null;
  }

  const parentText = typeof $from.parent?.textBetween === 'function'
    ? $from.parent.textBetween(0, $from.parent.content.size, '\n', '\n')
    : typeof $from.parent?.textContent === 'string'
      ? $from.parent.textContent
      : '';
  return parentText.trim();
}

export function inferCodeBlockLanguage(view: EditorView): string | null {
  const { from, to, empty, $from } = view.state.selection;
  const sourceSize = !empty && to > from
    ? to - from
    : (typeof $from.parent?.content?.size === 'number'
      ? $from.parent.content.size
      : typeof $from.parent?.textContent === 'string'
        ? $from.parent.textContent.length
        : 0);
  if (sourceSize > MAX_LANGUAGE_DETECTION_CODE_CHARS) {
    return null;
  }

  const sourceText = getSelectedCodeBlockSourceText(view);
  if (!sourceText) {
    return null;
  }

  return normalizeCodeBlockLanguage(guessLanguage(sourceText));
}

function createCodeBlockContent(view: EditorView, text: string) {
  return text.length > 0 ? view.state.schema.text(text) : null;
}

function convertSelectionToSingleCodeBlock(view: EditorView): boolean {
  const codeBlockType = view.state.schema.nodes.code_block;
  if (!codeBlockType) {
    return false;
  }

  const codeText = getSelectedCodeBlockSourceText(view);
  if (codeText === null) {
    return false;
  }
  const attrs = createCodeBlockAttrs({
    language: inferCodeBlockLanguage(view),
  });
  const codeBlockNode = codeBlockType.create(attrs, createCodeBlockContent(view, codeText));
  const { from, to } = view.state.selection;
  const tr = view.state.tr.replaceRangeWith(from, to, codeBlockNode).scrollIntoView();
  view.dispatch(tr);
  return true;
}

function isTableContainer(typeName: string | undefined): boolean {
  return typeName === 'table_cell' || typeName === 'table_header';
}

function isConvertibleTextBlock(node: { type: { name: string } }): boolean {
  return node.type.name === 'paragraph' || node.type.name === 'heading';
}

function canConvertTextBlockInParent(parentTypeName: string | undefined): boolean {
  return !isTableContainer(parentTypeName);
}

function isInsideTableContainerAtDepth(
  $pos: EditorView['state']['selection']['$from'],
  depth: number
): boolean {
  for (let currentDepth = depth - 1; currentDepth > 0; currentDepth -= 1) {
    if (isTableContainer($pos.node(currentDepth)?.type.name)) {
      return true;
    }
  }

  return false;
}

function getSelectionBoundaryTextBlock(
  $pos: EditorView['state']['selection']['$from'] | undefined
): { node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number } | null {
  if (!$pos || typeof $pos.depth !== 'number' || typeof $pos.node !== 'function') {
    return null;
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!isConvertibleTextBlock(node)) {
      continue;
    }

    if (isInsideTableContainerAtDepth($pos, depth)) {
      return null;
    }

    return {
      node,
      pos: $pos.before(depth),
    };
  }

  return null;
}

function resolveSingleSelectedTextBlock(view: EditorView): { from: number; to: number } | null {
  const { selection } = view.state;
  const fromEntry = getSelectionBoundaryTextBlock(selection.$from);
  const toEntry = getSelectionBoundaryTextBlock('$to' in selection ? selection.$to : undefined);
  if (!fromEntry || !toEntry || fromEntry.pos !== toEntry.pos) {
    return null;
  }

  const node = view.state.doc.nodeAt(fromEntry.pos);
  if (!node || !isConvertibleTextBlock(node)) {
    return null;
  }

  return {
    from: fromEntry.pos + 1,
    to: fromEntry.pos + Math.max(1, node.nodeSize - 1),
  };
}

function runWithSingleTextBlockSelection(view: EditorView, command: () => void): void {
  const range = resolveSingleSelectedTextBlock(view);
  if (!range || view.state.selection.empty) {
    command();
    return;
  }

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
      .setMeta('addToHistory', false)
  );
  command();
}

export function getDomSelectedTextBlocks(
  view: EditorView
): Array<{ node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number }> {
  if (typeof window === 'undefined' || !(view.dom instanceof HTMLElement)) {
    return [];
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return [];
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return [];
  }

  const seen = new Set<number>();
  const entries: Array<{ node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number }> = [];

  for (
    let index = 0;
    index < view.dom.children.length && index < MAX_BLOCK_COMMAND_DOM_SELECTION_CHILDREN;
    index += 1
  ) {
    const child = view.dom.children.item(index);
    if (!(child instanceof HTMLElement)) {
      continue;
    }

    let intersects = false;
    try {
      intersects = range.intersectsNode(child);
    } catch {
      intersects = false;
    }

    if (!intersects) {
      continue;
    }

    let rawPos: number | null = null;
    try {
      rawPos = view.posAtDOM(child, 0);
    } catch {
      rawPos = null;
    }

    if (rawPos === null) {
      continue;
    }

    const pos = normalizeTopLevelBlockPos(view, rawPos);
    if (pos === null || seen.has(pos)) {
      continue;
    }

    const node = view.state.doc.nodeAt(pos);
    if (!node || !isConvertibleTextBlock(node)) {
      continue;
    }

    seen.add(pos);
    entries.push({ node, pos });
  }

  return entries;
}

function applyTextBlockTypeAcrossSelection(
  view: EditorView,
  nodeType: { name: string } | undefined,
  attrs?: Record<string, unknown>,
): { handled: boolean; tr: EditorView['state']['tr'] | null } {
  const { state, dispatch } = view;
  const { from, to, empty } = state.selection;
  if (
    empty ||
    !nodeType ||
    !state.doc ||
    typeof state.doc.nodesBetween !== 'function'
  ) {
    return { handled: false, tr: null };
  }

  const seenPositions = new Set<number>();
  const targets = new Map<number, { node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number }>();

  const registerTarget = (
    node: { type: { name: string }; attrs?: Record<string, unknown> },
    pos: number
  ) => {
    if (seenPositions.has(pos)) {
      return;
    }

    seenPositions.add(pos);
    targets.set(pos, { node, pos });
  };

  const boundaryEntries = [
    getSelectionBoundaryTextBlock(state.selection.$from),
    getSelectionBoundaryTextBlock('$to' in state.selection ? state.selection.$to : undefined),
  ];

  for (const entry of boundaryEntries) {
    if (!entry) {
      continue;
    }

    registerTarget(entry.node, entry.pos);
  }

  const domSelectionEntries = getDomSelectedTextBlocks(view);
  for (const entry of domSelectionEntries) {
    registerTarget(entry.node, entry.pos);
  }

  forEachBoundedSelectedNode(state.doc, from, to, (node, pos, parent) => {
    if (targets.size >= MAX_BLOCK_COMMAND_NODE_UPDATES) {
      return false;
    }
    if (!isConvertibleTextBlock(node)) {
      return;
    }

    if (!canConvertTextBlockInParent(parent?.type.name)) {
      return false;
    }

    registerTarget(node, pos);
    return false;
  });

  const orderedTargets = Array.from(targets.values()).sort((a, b) => b.pos - a.pos);

  if (orderedTargets.length === 0) {
    return { handled: false, tr: null };
  }

  let updated = false;

  for (const target of orderedTargets) {
    const currentNode = view.state.doc.nodeAt(target.pos);
    if (!currentNode || !isConvertibleTextBlock(currentNode)) {
      continue;
    }

    const selectionPos = Math.max(1, Math.min(target.pos + 1, view.state.doc.content.size));
    dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, selectionPos))
        .setMeta('addToHistory', false)
    );

    const beforeNodeDoc = view.state.doc;
    convertToTextBlock(view, nodeType, attrs);
    const nodeChanged = !beforeNodeDoc.eq(view.state.doc);
    updated = updated || nodeChanged;
  }
  return { handled: updated, tr: null };
}

function applyTextBlockTypeAcrossBlockSelection(
  view: EditorView,
  nodeType: { name: string } | undefined,
  attrs?: Record<string, unknown>,
): boolean {
  if (!nodeType || !view.state.doc || typeof view.state.doc.nodesBetween !== 'function') {
    return false;
  }

  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  if (selectedBlocks.length === 0) {
    return false;
  }

  const seenPositions = new Set<number>();
  const targets: Array<{ pos: number }> = [];
  for (const range of selectedBlocks) {
    if (targets.length >= MAX_BLOCK_COMMAND_NODE_UPDATES) {
      break;
    }
    forEachBoundedSelectedNode(view.state.doc, range.from, range.to, (node, pos, parent) => {
      if (targets.length >= MAX_BLOCK_COMMAND_NODE_UPDATES) {
        return false;
      }
      if (!isConvertibleTextBlock(node) || !canConvertTextBlockInParent(parent?.type.name)) {
        return;
      }

      if (!seenPositions.has(pos)) {
        seenPositions.add(pos);
        targets.push({ pos });
      }

      return false;
    });
  }

  if (targets.length === 0) {
    return false;
  }

  let updated = false;
  for (const target of targets.sort((a, b) => b.pos - a.pos)) {
    const currentNode = view.state.doc.nodeAt(target.pos);
    if (!currentNode || !isConvertibleTextBlock(currentNode)) {
      continue;
    }

    const selectionPos = Math.max(1, Math.min(target.pos + 1, view.state.doc.content.size));
    view.dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, selectionPos))
        .setMeta('addToHistory', false)
    );

    const beforeNodeDoc = view.state.doc;
    convertToTextBlock(view, nodeType, attrs);
    updated = updated || !beforeNodeDoc.eq(view.state.doc);
  }

  return updated;
}

export function convertBlockType(view: EditorView, blockType: BlockType): void {
  const { state } = view;
  const hasBlockSelection = hasSelectedBlocks(state);
  markEditorUserInput(view);

  if (blockType === 'paragraph' || getHeadingLevel(blockType) !== null) {
    const targetNodeType = blockType === 'paragraph'
      ? state.schema.nodes.paragraph
      : state.schema.nodes.heading;
    const headingLevel = getHeadingLevel(blockType);
    if (hasBlockSelection) {
      if (applyTextBlockTypeAcrossBlockSelection(
        view,
        targetNodeType,
        headingLevel !== null ? { level: headingLevel } : undefined
      )) {
        view.focus();
      }
      return;
    }

    const selectionResult = applyTextBlockTypeAcrossSelection(
      view,
      targetNodeType,
      headingLevel !== null ? { level: headingLevel } : undefined
    );

    if (selectionResult.handled) {
      view.focus();
      return;
    }
  }

  if (hasBlockSelection) {
    return;
  }

  switch (blockType) {
    case 'paragraph': {
      const paragraphType = state.schema.nodes.paragraph;
      if (paragraphType) {
        convertToTextBlock(view, paragraphType);
      }
      break;
    }

    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6': {
      const level = getHeadingLevel(blockType);
      const headingType = state.schema.nodes.heading;
      if (headingType && level !== null) {
        convertToTextBlock(view, headingType, { level });
      }
      break;
    }

    case 'blockquote': {
      const blockquoteType = state.schema.nodes.blockquote;
      if (blockquoteType) {
        runWithSingleTextBlockSelection(view, () => {
          const parent = view.state.selection.$from.node(-1);
          if (parent && parent.type.name === 'blockquote') {
            lift(view.state, view.dispatch);
          } else {
            normalizeCurrentBlockToParagraph(view, { unwrapListItem: true });
            wrapIn(blockquoteType)(view.state, view.dispatch);
          }
        });
      }
      break;
    }

    case 'bulletList': {
      const bulletListType = state.schema.nodes.bullet_list;
      if (bulletListType) {
        runWithSingleTextBlockSelection(view, () => convertToList(view, bulletListType));
      }
      break;
    }

    case 'orderedList': {
      const orderedListType = state.schema.nodes.ordered_list;
      if (orderedListType) {
        runWithSingleTextBlockSelection(view, () => convertToList(view, orderedListType));
      }
      break;
    }

    case 'taskList': {
      const bulletListType = state.schema.nodes.bullet_list;
      if (bulletListType) {
        runWithSingleTextBlockSelection(view, () => convertToList(view, bulletListType, { checked: false }));
      }
      break;
    }

    case 'codeBlock': {
      if (state.selection.empty) {
        const codeBlockType = state.schema.nodes.code_block;
        if (codeBlockType) {
          convertToTextBlock(view, codeBlockType, createCodeBlockAttrs({
            language: inferCodeBlockLanguage(view),
          }));
        }
        break;
      }

      convertSelectionToSingleCodeBlock(view);
      break;
    }
  }

  view.focus();
}

export function setTextAlignment(view: EditorView, alignment: TextAlignment): void {
  const { state, dispatch } = view;
  const { from, to, $from } = state.selection;
  const tr = state.tr;
  let updated = false;
  let updateCount = 0;
  const selectedBlocks = getBlockSelectionPluginState(state).selectedBlocks;

  const isUnsupportedContainer = (typeName: string | undefined) =>
    typeName === 'table_cell' || typeName === 'table_header';

  const applyAlignmentAcrossRange = (rangeFrom: number, rangeTo: number) => {
    forEachBoundedSelectedNode(state.doc, rangeFrom, rangeTo, (node, pos, parent) => {
      if (updateCount >= MAX_BLOCK_COMMAND_NODE_UPDATES) {
        return false;
      }
      if (node.type.name !== 'paragraph' && node.type.name !== 'heading') {
        return;
      }

      if (isUnsupportedContainer(parent?.type.name)) {
        return false;
      }

      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        align: alignment,
      });
      updated = true;
      updateCount += 1;

      return false;
    });
  };

  if (selectedBlocks.length > 0) {
    for (const range of selectedBlocks) {
      if (updateCount >= MAX_BLOCK_COMMAND_NODE_UPDATES) {
        break;
      }
      applyAlignmentAcrossRange(range.from, range.to);
    }
  } else {
    applyAlignmentAcrossRange(from, to);
  }

  if (!updated && selectedBlocks.length === 0) {
    const parent = $from.parent;
    const ancestor = $from.node(-1);
    if (
      (parent.type.name === 'paragraph' || parent.type.name === 'heading') &&
      !isUnsupportedContainer(ancestor.type.name)
    ) {
      const targetPos = $from.before();
      tr.setNodeMarkup(targetPos, undefined, {
        ...parent.attrs,
        align: alignment,
      });
      updated = true;
    }
  }

  if (!updated) {
    return;
  }

  markEditorUserInput(view);
  dispatch(tr);
  view.focus();
}
