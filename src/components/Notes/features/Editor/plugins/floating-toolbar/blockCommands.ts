import { lift, wrapIn } from '@milkdown/kit/prose/commands';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';
import { getBlockSelectionPluginState, hasSelectedBlocks } from '../cursor/blockSelectionPluginState';
import { markEditorUserInput } from '../shared/userInputEvents';
import {
  convertToList,
  convertToTextBlock,
  normalizeCurrentBlockToParagraph,
} from './blockTypeConversion';
import { inferCodeBlockLanguage, convertSelectionToSingleCodeBlock } from './blockCommandsCodeBlock';
import {
  canConvertTextBlockInParent,
  forEachBoundedSelectedNode,
  getDomSelectedTextBlocks,
  getHeadingLevel,
  getSelectionBoundaryTextBlock,
  isConvertibleTextBlock,
  runWithSingleTextBlockSelection,
} from './blockCommandsTraversal';
import { MAX_BLOCK_COMMAND_NODE_UPDATES } from './blockCommandsLimits';

export {
  MAX_BLOCK_COMMAND_DOM_SELECTION_CHILDREN,
  MAX_BLOCK_COMMAND_SELECTION_SCAN_NODES,
  MAX_BLOCK_COMMAND_NODE_UPDATES,
  MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS,
} from './blockCommandsLimits';
export {
  getSelectedCodeBlockSourceText,
  inferCodeBlockLanguage,
} from './blockCommandsCodeBlock';
export { getDomSelectedTextBlocks } from './blockCommandsTraversal';
export { setTextAlignment } from './blockCommandsAlignment';

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
    if (seenPositions.has(pos)) return;
    seenPositions.add(pos);
    targets.set(pos, { node, pos });
  };

  const boundaryEntries = [
    getSelectionBoundaryTextBlock(state.selection.$from),
    getSelectionBoundaryTextBlock('$to' in state.selection ? state.selection.$to : undefined),
  ];
  for (const entry of boundaryEntries) {
    if (entry) registerTarget(entry.node, entry.pos);
  }

  for (const entry of getDomSelectedTextBlocks(view)) {
    registerTarget(entry.node, entry.pos);
  }

  forEachBoundedSelectedNode(state.doc, from, to, (node, pos, parent) => {
    if (targets.size >= MAX_BLOCK_COMMAND_NODE_UPDATES) return false;
    if (!isConvertibleTextBlock(node)) return;
    if (!canConvertTextBlockInParent(parent?.type?.name)) return false;
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
    if (!currentNode || !isConvertibleTextBlock(currentNode)) continue;

    const selectionPos = Math.max(1, Math.min(target.pos + 1, view.state.doc.content.size));
    dispatch(
      view.state.tr
        .setSelection(TextSelection.create(view.state.doc, selectionPos))
        .setMeta('addToHistory', false)
    );

    const beforeNodeDoc = view.state.doc;
    convertToTextBlock(view, nodeType, attrs);
    updated = updated || !beforeNodeDoc.eq(view.state.doc);
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
  if (selectedBlocks.length === 0) return false;

  const seenPositions = new Set<number>();
  const targets: Array<{ pos: number }> = [];
  for (const range of selectedBlocks) {
    if (targets.length >= MAX_BLOCK_COMMAND_NODE_UPDATES) break;
    forEachBoundedSelectedNode(view.state.doc, range.from, range.to, (node, pos, parent) => {
      if (targets.length >= MAX_BLOCK_COMMAND_NODE_UPDATES) return false;
      if (!isConvertibleTextBlock(node) || !canConvertTextBlockInParent(parent?.type?.name)) return;

      if (!seenPositions.has(pos)) {
        seenPositions.add(pos);
        targets.push({ pos });
      }
      return false;
    });
  }

  if (targets.length === 0) return false;

  let updated = false;
  for (const target of targets.sort((a, b) => b.pos - a.pos)) {
    const currentNode = view.state.doc.nodeAt(target.pos);
    if (!currentNode || !isConvertibleTextBlock(currentNode)) continue;

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

  if (hasBlockSelection) return;

  switch (blockType) {
    case 'paragraph': {
      const paragraphType = state.schema.nodes.paragraph;
      if (paragraphType) convertToTextBlock(view, paragraphType);
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
      if (headingType && level !== null) convertToTextBlock(view, headingType, { level });
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
      if (bulletListType) runWithSingleTextBlockSelection(view, () => convertToList(view, bulletListType));
      break;
    }

    case 'orderedList': {
      const orderedListType = state.schema.nodes.ordered_list;
      if (orderedListType) runWithSingleTextBlockSelection(view, () => convertToList(view, orderedListType));
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
