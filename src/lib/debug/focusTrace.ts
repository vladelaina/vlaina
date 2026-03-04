export function isFocusTraceEnabled(): boolean {
  return false;
}

export function logFocusTrace(_label: string, _meta?: Record<string, unknown>): void {
  // no-op: focus tracing is intentionally disabled to keep console clean
}
