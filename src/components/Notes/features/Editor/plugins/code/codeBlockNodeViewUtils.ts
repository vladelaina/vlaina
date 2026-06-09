import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { ViewUpdate } from '@codemirror/view';
import { Transaction } from '@codemirror/state';
import { mapCodeBlockEditorOffsetToDocumentOffset } from './codemirror';
import { normalizeCodeBlockLanguage } from './codeBlockLanguage';
import { getCodeBlockSourceText } from './codeBlockText';
import { guessLanguage } from '../../utils/languageGuesser';

function isPasteUpdate(update: ViewUpdate) {
  return update.transactions.some((transaction) => {
    const userEvent = transaction.annotation(Transaction.userEvent);
    return userEvent === 'input.paste' || userEvent?.startsWith('input.paste.');
  });
}

function shouldAutoDetectLanguageAfterPaste(args: {
  update: ViewUpdate;
  previousText: string;
  nextText: string;
}) {
  const { update, previousText, nextText } = args;
  return update.docChanged
    && previousText.trim().length === 0
    && nextText.trim().length > 0
    && isPasteUpdate(update);
}

export function forwardCodeBlockUpdate(
  update: ViewUpdate,
  view: EditorView,
  getPos: () => number | undefined
) {
  const codeBlockPos = getPos() ?? 0;
  const codeBlockStart = codeBlockPos + 1;
  const { main } = update.state.selection;
  const currentDoc =
    view.state.doc as { nodeAt?: (pos: number) => Parameters<typeof getCodeBlockSourceText>[0] | null } | undefined;
  const currentCodeBlock =
    typeof currentDoc?.nodeAt === 'function' ? currentDoc.nodeAt(codeBlockPos) : null;
  const currentRawText = currentCodeBlock ? getCodeBlockSourceText(currentCodeBlock) : '';
  const currentSelectionFrom =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, main.from);
  const currentSelectionTo =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, main.to);
  const pmSelection = view.state.selection;

  if (!update.docChanged && pmSelection.from === currentSelectionFrom && pmSelection.to === currentSelectionTo) {
    return null;
  }

  const tr = view.state.tr;
  update.changes.iterChanges((fromA, toA, _fromB, _toB, text) => {
    const from = tr.mapping.map(
      codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, fromA),
      -1
    );
    const to = tr.mapping.map(
      codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, toA),
      1
    );
    if (text.length > 0) {
      tr.replaceWith(from, to, view.state.schema.text(text.toString()));
    } else {
      tr.delete(from, to);
    }
  });

  const nextDoc = tr.doc as {
    nodeAt?: (pos: number) => (Parameters<typeof getCodeBlockSourceText>[0] & { attrs?: Record<string, unknown> }) | null;
  };
  const nextCodeBlock = typeof nextDoc.nodeAt === 'function' ? nextDoc.nodeAt(codeBlockPos) : null;
  const nextRawText = nextCodeBlock ? getCodeBlockSourceText(nextCodeBlock) : '';
  if (nextCodeBlock && shouldAutoDetectLanguageAfterPaste({
    update,
    previousText: currentRawText,
    nextText: nextRawText,
  })) {
    const detectedLanguage = normalizeCodeBlockLanguage(guessLanguage(nextRawText) || 'txt');
    tr.setNodeMarkup(codeBlockPos, undefined, {
      ...nextCodeBlock.attrs,
      language: detectedLanguage,
    });
  }
  const nextSelectionFrom =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(nextRawText, main.from);
  const nextSelectionTo =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(nextRawText, main.to);
  tr.setSelection(TextSelection.create(tr.doc, nextSelectionFrom, nextSelectionTo));
  return tr;
}

export function applyCodeBlockCollapsedState(dom: HTMLElement, editorDOM: HTMLElement, collapsed: boolean) {
  dom.setAttribute('data-collapsed', String(collapsed));
  editorDOM.style.display = collapsed ? 'none' : '';
  if (collapsed) {
    editorDOM.setAttribute('aria-hidden', 'true');
    editorDOM.tabIndex = -1;
    return;
  }

  editorDOM.removeAttribute('aria-hidden');
  editorDOM.removeAttribute('tabindex');
}
