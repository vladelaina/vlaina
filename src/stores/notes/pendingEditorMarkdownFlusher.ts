

let pendingEditorMarkdownFlusher: (() => boolean) | null = null;
let pendingEditorMarkdownFlusherId = 0;

export function setPendingEditorMarkdownFlusher(flusher: (() => boolean) | null): () => void {
  const flusherId = ++pendingEditorMarkdownFlusherId;
  pendingEditorMarkdownFlusher = flusher;

  return () => {
    if (pendingEditorMarkdownFlusherId === flusherId) {
      pendingEditorMarkdownFlusher = null;
    }
  };
}

export function flushCurrentPendingEditorMarkdown(): boolean {
  const flushed = pendingEditorMarkdownFlusher?.() ?? false;
  return flushed;
}
