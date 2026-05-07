let suppressPreviewEditorOpenUntil = 0;

export function suppressPreviewEditorOpen(durationMs = 500) {
  suppressPreviewEditorOpenUntil = Date.now() + durationMs;
}

export function shouldSuppressPreviewEditorOpen() {
  return Date.now() < suppressPreviewEditorOpenUntil;
}
