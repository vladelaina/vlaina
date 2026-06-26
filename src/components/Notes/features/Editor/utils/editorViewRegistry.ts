import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser, Serializer } from '@milkdown/kit/transformer';
import { normalizeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';
import {
  normalizeAlternativeMathBlockFences,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';

let currentEditorView: EditorView | null = null;
let currentMarkdownParser: Parser | null = null;
let currentMarkdownSerializer: Serializer | null = null;
let currentEditorBlockSelectionClearer: (() => void) | null = null;
const editorViewListeners = new Set<(view: EditorView | null) => void>();

export function setCurrentEditorView(view: EditorView | null): void {
  currentEditorView = view;
  if (view === null) {
    currentEditorBlockSelectionClearer = null;
  }
  editorViewListeners.forEach((listener) => {
    listener(view);
  });
}

export function getCurrentEditorView(): EditorView | null {
  return currentEditorView;
}

export function setCurrentEditorBlockSelectionClearer(clearer: (() => void) | null): void {
  currentEditorBlockSelectionClearer = clearer;
}

export function clearCurrentEditorBlockSelection(): void {
  currentEditorBlockSelectionClearer?.();
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
  serializer?: Serializer | null;
}): void {
  currentMarkdownParser = runtime.parser
    ? ((markdown: string) => runtime.parser!(
        preserveMarkdownBlankLinesForEditor(
          normalizeLeadingFrontmatterMarkdown(normalizeAlternativeMathBlockFences(markdown))
        )
      )) as Parser
    : null;
  currentMarkdownSerializer = runtime.serializer ?? null;
}

export function clearCurrentMarkdownRuntime(): void {
  currentMarkdownParser = null;
  currentMarkdownSerializer = null;
}

export function getCurrentMarkdownParser(): Parser | null {
  return currentMarkdownParser;
}

export function getCurrentMarkdownSerializer(): Serializer | null {
  return currentMarkdownSerializer;
}
