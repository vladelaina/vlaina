import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser } from '@milkdown/kit/transformer';
import { normalizeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';
import { preserveMarkdownBlankLinesForEditor } from '../plugins/clipboard/markdownSerializationUtils';

let currentEditorView: EditorView | null = null;
let currentMarkdownParser: Parser | null = null;
const editorViewListeners = new Set<(view: EditorView | null) => void>();

export function setCurrentEditorView(view: EditorView | null): void {
  currentEditorView = view;
  editorViewListeners.forEach((listener) => {
    listener(view);
  });
}

export function getCurrentEditorView(): EditorView | null {
  return currentEditorView;
}

export function subscribeCurrentEditorView(
  listener: (view: EditorView | null) => void,
): () => void {
  editorViewListeners.add(listener);
  return () => {
    editorViewListeners.delete(listener);
  };
}

export function setCurrentMarkdownRuntime(runtime: {
  parser: Parser | null;
}): void {
  currentMarkdownParser = runtime.parser
    ? ((markdown: string) => runtime.parser!(
        preserveMarkdownBlankLinesForEditor(normalizeLeadingFrontmatterMarkdown(markdown))
      )) as Parser
    : null;
}

export function clearCurrentMarkdownRuntime(): void {
  currentMarkdownParser = null;
}

export function getCurrentMarkdownParser(): Parser | null {
  return currentMarkdownParser;
}
