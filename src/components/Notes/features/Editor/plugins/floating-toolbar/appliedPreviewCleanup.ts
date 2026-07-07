const previewCleanupCallbacks = new WeakMap<HTMLElement, () => void>();

export function registerAppliedPreviewCleanup(previewDom: HTMLElement, cleanup: () => void): void {
  previewCleanupCallbacks.set(previewDom, cleanup);
}

export function cleanupAppliedPreviewDocument(previewDom: HTMLElement): void {
  previewCleanupCallbacks.get(previewDom)?.();
  previewCleanupCallbacks.delete(previewDom);
}
