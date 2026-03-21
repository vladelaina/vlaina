import { Slice } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeSerializedMarkdownSelection } from '../../clipboard/markdownSerializationUtils';
import { serializeSliceToText } from '../../clipboard/serializer';
import { getCurrentMarkdownParser } from '../../../utils/editorViewRegistry';
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

function parseMarkdownToSlice(
  view: EditorView,
  from: number,
  to: number,
  markdown: string
): Slice | null {
  const parser = getCurrentMarkdownParser();
  if (!parser) {
    return null;
  }

  try {
    const doc = parser(markdown);
    const currentSlice = view.state.doc.slice(from, to);
    return new Slice(doc.content as Slice['content'], currentSlice.openStart, currentSlice.openEnd);
  } catch (error) {
    logAiSelectionDebug('selection:replace:parse-failed', {
      error: error instanceof Error ? error.message : String(error),
      preview: markdown.slice(0, 120),
    });
    return null;
  }
}

function replaceSelectionWithText(view: EditorView, from: number, to: number, text: string) {
  logAiSelectionDebug('selection:replace:start', {
    from,
    to,
    nextLength: text.length,
    nextPreview: text.slice(0, 120),
  });

  const parsedSlice = parseMarkdownToSlice(view, from, to, text);
  const tr = parsedSlice
    ? view.state.tr.replaceRange(from, to, parsedSlice).scrollIntoView()
    : view.state.tr.insertText(text, from, to).scrollIntoView();
  view.dispatch(tr);
  view.focus();
  logAiSelectionDebug('selection:replace:done', {
    mode: parsedSlice ? 'markdown' : 'text',
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
