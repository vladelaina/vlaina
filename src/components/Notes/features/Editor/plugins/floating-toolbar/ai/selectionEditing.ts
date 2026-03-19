import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeSerializedMarkdownSelection } from '../../clipboard/markdownSerializationUtils';
import { serializeSliceToText } from '../../clipboard/serializer';
import { logAiSelectionDebug } from './debug';
import type { AiSelectionSuggestion } from './selectionCommandTypes';

export function getSerializedSelectionText(view: EditorView): string {
  const { from, to } = view.state.selection;
  logAiSelectionDebug('selection:serialize:start', {
    from,
    to,
    empty: from >= to,
  });

  if (from >= to) {
    logAiSelectionDebug('selection:serialize:empty');
    return '';
  }

  const serialized = normalizeSerializedMarkdownSelection(
    serializeSliceToText(view.state.doc.slice(from, to))
  );
  logAiSelectionDebug('selection:serialize:done', {
    length: serialized.length,
    preview: serialized.slice(0, 120),
  });
  return serialized;
}

function replaceSelectionWithText(view: EditorView, from: number, to: number, text: string) {
  logAiSelectionDebug('selection:replace:start', {
    from,
    to,
    nextLength: text.length,
    nextPreview: text.slice(0, 120),
  });
  const tr = view.state.tr.insertText(text, from, to).scrollIntoView();
  view.dispatch(tr);
  view.focus();
  logAiSelectionDebug('selection:replace:done', {
    nextSelectionFrom: view.state.selection.from,
    nextSelectionTo: view.state.selection.to,
  });
}

export function applyAiSelectionSuggestion(
  view: EditorView,
  suggestion: AiSelectionSuggestion
): boolean {
  const maxPos = view.state.doc.content.size;
  const from = Math.max(0, Math.min(suggestion.from, maxPos));
  const to = Math.max(from, Math.min(suggestion.to, maxPos));
  replaceSelectionWithText(view, from, to, suggestion.suggestedText);
  logAiSelectionDebug('execute:success');
  return true;
}
