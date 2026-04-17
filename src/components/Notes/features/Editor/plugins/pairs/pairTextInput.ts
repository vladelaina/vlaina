import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

import { consumeDuplicateCloseEvent, recordSkippedCloser } from './pairDuplicateCloseGuard';
import { closePairSpecs, openPairSpecs } from './pairSpecs';
import {
  createAddAutoClosersMeta,
  hasAutoInsertedCloserAt,
  autoPairPluginKey,
} from './pairState';

function isWordLikeChar(char: string | undefined): boolean {
  return typeof char === 'string' && /[\p{L}\p{N}_]/u.test(char);
}

function shouldAutoPairSymmetricQuote(
  text: string,
  offset: number,
): boolean {
  return !isWordLikeChar(text[offset - 1]);
}

function moveSelectionTo(view: EditorView, position: number): void {
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, position)),
  );
}

function insertPairedText(
  view: EditorView,
  from: number,
  to: number,
  open: string,
  close: string,
  cursorOffset: number,
  closePos: number,
): void {
  const tr = view.state.tr.insertText(open + close, from, to);
  tr
    .setSelection(TextSelection.create(tr.doc, from + cursorOffset))
    .setMeta(autoPairPluginKey, createAddAutoClosersMeta([{ close, pos: closePos }]));
  view.dispatch(tr);
}

function handleClosingPairSkip(
  view: EditorView,
  from: number,
  text: string,
): boolean {
  const { selection } = view.state;
  if (!selection.empty || selection.from !== from) return false;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return false;
  if ($from.parent.textContent[$from.parentOffset] !== text) return false;
  if (!closePairSpecs.has(text)) return false;
  if (!hasAutoInsertedCloserAt(view.state, from, text)) return false;

  moveSelectionTo(view, from + text.length);
  recordSkippedCloser(view, text, from, from + text.length);
  return true;
}

function handleSelectionWrap(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  if (from === to) return false;

  const spec = openPairSpecs.get(text);
  if (!spec) return false;

  const { selection } = view.state;
  if (!selection.$from.parent.isTextblock || selection.$from.parent !== selection.$to.parent) {
    return false;
  }

  const selectedText = view.state.doc.textBetween(from, to, '');
  const wrappedText = spec.open + selectedText + spec.close;
  const tr = view.state.tr.insertText(wrappedText, from, to);
  tr
    .setSelection(TextSelection.create(tr.doc, from + wrappedText.length))
    .setMeta(
      autoPairPluginKey,
      createAddAutoClosersMeta([{ close: spec.close, pos: from + spec.open.length + selectedText.length }]),
    );
  view.dispatch(tr);
  return true;
}

function handleCollapsedOpenPair(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  if (from !== to) return false;

  const { selection } = view.state;
  if (!selection.empty || selection.from !== from) return false;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return false;

  const spec = openPairSpecs.get(text);
  if (!spec) return false;

  if (spec.symmetric && !shouldAutoPairSymmetricQuote($from.parent.textContent, $from.parentOffset)) {
    return false;
  }

  insertPairedText(view, from, to, spec.open, spec.close, spec.open.length, from + spec.open.length);
  return true;
}

export function handleAutoPairTextInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
): boolean {
  if (text.length !== 1) return false;

  if (consumeDuplicateCloseEvent(view, from, text)) return true;
  if (handleClosingPairSkip(view, from, text)) return true;
  if (handleSelectionWrap(view, from, to, text)) return true;
  return handleCollapsedOpenPair(view, from, to, text);
}
