import { Slice } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeSerializedMarkdownSelection } from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeSliceToText } from '../../clipboard/serializer';
import { getCurrentMarkdownParser } from '../../../utils/editorViewRegistry';
import type { AiSelectionSuggestion } from './selectionCommandTypes';

export function getSerializedSelectionText(view: EditorView): string {
  const { from, to } = view.state.selection;
  if (from >= to) {
    return '';
  }

  const serialized = normalizeSerializedMarkdownSelection(
    serializeSliceToText(view.state.doc.slice(from, to))
  );
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
    return null;
  }
}

function replaceSelectionWithText(view: EditorView, from: number, to: number, text: string) {
  const parsedSlice = parseMarkdownToSlice(view, from, to, text);
  const tr = parsedSlice
    ? view.state.tr.replaceRange(from, to, parsedSlice).scrollIntoView()
    : view.state.tr.insertText(text, from, to).scrollIntoView();
  view.dispatch(tr);
  view.focus();
}

export function applyAiSelectionSuggestion(
  view: EditorView,
  suggestion: AiSelectionSuggestion
): boolean {
  const maxPos = view.state.doc.content.size;
  const from = Math.max(0, Math.min(suggestion.from, maxPos));
  const to = Math.max(from, Math.min(suggestion.to, maxPos));
  replaceSelectionWithText(view, from, to, suggestion.suggestedText);
  return true;
}
