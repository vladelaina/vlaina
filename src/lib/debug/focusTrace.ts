function activeElementSnapshot(): Record<string, unknown> {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return { tag: null };

  return {
    tag: active.tagName,
    id: active.id || null,
    className: active.className || null,
    role: active.getAttribute('role'),
    hasDataDragRegion: active.hasAttribute('data-tauri-drag-region'),
    hasChatInputRoot: !!active.closest('[data-chat-input="true"]')
  };
}

export function isFocusTraceEnabled(): boolean {
  if (!import.meta.env.DEV) return false;
  return (globalThis as { __NEKO_FOCUS_DEBUG__?: boolean }).__NEKO_FOCUS_DEBUG__ !== false;
}

export function logFocusTrace(label: string, meta?: Record<string, unknown>): void {
  if (!isFocusTraceEnabled()) return;
  console.log(`[FocusTrace] ${label}`, {
    ...meta,
    documentHasFocus: document.hasFocus(),
    activeElement: activeElementSnapshot()
  });
}
