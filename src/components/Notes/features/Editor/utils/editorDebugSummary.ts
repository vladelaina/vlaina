import type { EditorView } from '@milkdown/kit/prose/view';
import {
  normalizeSerializedMarkdownDocument,
  summarizeMarkdownNormalizationPipeline,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { summarizeLineBreakText } from '@/stores/notes/lineBreakDebugLog';

export function summarizeEditorState(view: EditorView, serializer: (doc: unknown) => string) {
  try {
    const serialized = serializer(view.state.doc);
    const selection = view.state.selection;
    return {
      serialized: summarizeLineBreakText(serialized),
      normalized: summarizeLineBreakText(normalizeSerializedMarkdownDocument(serialized)),
      normalizationPipeline: summarizeMarkdownNormalizationPipeline(serialized),
      childCount: view.state.doc.childCount,
      docText: summarizeLineBreakText(
        view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n')
      ),
      selection: {
        from: selection.from,
        to: selection.to,
        empty: selection.empty,
        parentType: selection.$from.parent.type.name,
        parentOffset: selection.$from.parentOffset,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
