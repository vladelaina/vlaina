

let pendingEditorMarkdownFlusher: (() => boolean) | null = null;

export function setPendingEditorMarkdownFlusher(flusher: (() => boolean) | null): void {
  pendingEditorMarkdownFlusher = flusher;
}

export function flushCurrentPendingEditorMarkdown(): boolean {
  const flushed = pendingEditorMarkdownFlusher?.() ?? false;
  return flushed;
}
