import { type EditorState, TextSelection, type Transaction } from '@milkdown/kit/prose/state';
import { normalizeCodeBlockLanguage, parseCodeFenceLanguage } from './codeBlockLanguage';
import { createCodeBlockAttrs } from './codeBlockSettings';
import {
  isCursorAtCodeBlockEnd,
  moveSelectionAfterNode,
} from './codeBlockSelectionUtils';

type ProseDispatch = ((tr: Transaction) => void) | null | undefined;

export function convertParagraphToCodeBlock(
  state: EditorState,
  dispatch: ProseDispatch,
  language: string
) {
  const { selection, schema } = state;
  const $from = selection.$from;
  const start = $from.start($from.depth) - 1;
  const end = $from.end($from.depth) + 1;
  const codeBlockType = schema.nodes.code_block;

  if (!codeBlockType) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    const normalizedLanguage = normalizeCodeBlockLanguage(language);
    const node = codeBlockType.create(createCodeBlockAttrs({ language: normalizedLanguage }));
    tr.replaceWith(start, end, node);
    tr.setSelection(TextSelection.create(tr.doc, start + 1));
    dispatch(tr);
  }

  return true;
}

export function handleCodeBlockEnter(state: EditorState, dispatch: ProseDispatch) {
  const { selection } = state;
  if (!selection.empty) {
    return false;
  }

  const parent = selection.$from.parent;
  if (parent.type.name !== 'paragraph') {
    return false;
  }

  const language = parseCodeFenceLanguage(parent.textContent);
  if (language === null) {
    return false;
  }

  return convertParagraphToCodeBlock(state, dispatch, language);
}

export function moveCursorAfterCodeBlock(state: EditorState, dispatch: ProseDispatch) {
  const { selection } = state;
  if (!isCursorAtCodeBlockEnd(selection)) {
    return false;
  }

  if (!dispatch) {
    return true;
  }

  const tr = state.tr;
  const codeBlockPos = selection.$from.before();
  moveSelectionAfterNode(tr, codeBlockPos, selection.$from.parent.nodeSize);
  dispatch(tr.scrollIntoView());
  return true;
}

export function handleEmptyCodeBlockBackspace(
  state: EditorState,
  dispatch: ProseDispatch
) {
  const { selection } = state;
  const { $from, empty } = selection;

  if (!empty || $from.parent.type.name !== 'code_block' || $from.parent.textContent.length > 0) {
    return false;
  }

  if (dispatch) {
    const tr = state.tr;
    tr.delete($from.before(), $from.after());
    dispatch(tr);
  }

  return true;
}
