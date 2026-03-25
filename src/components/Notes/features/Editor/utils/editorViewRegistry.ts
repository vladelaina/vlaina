import type { EditorView } from '@milkdown/kit/prose/view';
import type { Parser } from '@milkdown/kit/transformer';
import { normalizeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';

let currentEditorView: EditorView | null = null;
let currentMarkdownParser: Parser | null = null;

export function setCurrentEditorView(view: EditorView | null): void {
  currentEditorView = view;
}

export function getCurrentEditorView(): EditorView | null {
  return currentEditorView;
}

export function setCurrentMarkdownRuntime(runtime: {
  parser: Parser | null;
}): void {
  currentMarkdownParser = runtime.parser
    ? ((markdown: string) => runtime.parser!(normalizeLeadingFrontmatterMarkdown(markdown))) as Parser
    : null;
}

export function clearCurrentMarkdownRuntime(): void {
  currentMarkdownParser = null;
}

export function getCurrentMarkdownParser(): Parser | null {
  return currentMarkdownParser;
}
