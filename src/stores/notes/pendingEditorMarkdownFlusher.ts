import { logLineBreakDebug } from './lineBreakDebugLog';

let pendingEditorMarkdownFlusher: (() => boolean) | null = null;

export function setPendingEditorMarkdownFlusher(flusher: (() => boolean) | null): void {
  pendingEditorMarkdownFlusher = flusher;
}

export function flushCurrentPendingEditorMarkdown(): boolean {
  const flushed = pendingEditorMarkdownFlusher?.() ?? false;
  logLineBreakDebug('pending:flush-current', { hasFlusher: Boolean(pendingEditorMarkdownFlusher), flushed });
  return flushed;
}
