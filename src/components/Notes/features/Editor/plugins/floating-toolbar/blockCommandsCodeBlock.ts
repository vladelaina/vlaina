import type { EditorView } from '@milkdown/kit/prose/view';
import { createCodeBlockAttrs } from '../code/codeBlockSettings';
import { normalizeCodeBlockLanguage } from '../code/codeBlockLanguage';
import { guessLanguage, MAX_LANGUAGE_DETECTION_CODE_CHARS } from '../../utils/languageDetection';
import { MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS } from './blockCommandsLimits';

export function getSelectedCodeBlockSourceText(view: EditorView): string | null {
  const { state } = view;
  const { from, to, empty, $from } = state.selection;
  if (!empty && to > from && typeof state.doc?.textBetween === 'function') {
    if (to - from > MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS) return null;
    return state.doc.textBetween(from, to, '\n', '\n').trim();
  }

  const parentSize = typeof $from.parent?.content?.size === 'number'
    ? $from.parent.content.size
    : typeof $from.parent?.textContent === 'string'
      ? $from.parent.textContent.length
      : 0;
  if (parentSize > MAX_CODE_BLOCK_CONVERSION_TEXT_CHARS) return null;

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
  if (sourceSize > MAX_LANGUAGE_DETECTION_CODE_CHARS) return null;

  const sourceText = getSelectedCodeBlockSourceText(view);
  if (!sourceText) return null;
  return normalizeCodeBlockLanguage(guessLanguage(sourceText));
}

function createCodeBlockContent(view: EditorView, text: string) {
  return text.length > 0 ? view.state.schema.text(text) : null;
}

export function convertSelectionToSingleCodeBlock(view: EditorView): boolean {
  const codeBlockType = view.state.schema.nodes.code_block;
  if (!codeBlockType) return false;

  const codeText = getSelectedCodeBlockSourceText(view);
  if (codeText === null) return false;
  const attrs = createCodeBlockAttrs({ language: inferCodeBlockLanguage(view) });
  const codeBlockNode = codeBlockType.create(attrs, createCodeBlockContent(view, codeText));
  const { from, to } = view.state.selection;
  const tr = view.state.tr.replaceRangeWith(from, to, codeBlockNode).scrollIntoView();
  view.dispatch(tr);
  return true;
}
