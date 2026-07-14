import { useSyncExternalStore } from 'react';

type MarkdownThemePreviewId = string | null | undefined;

let previewThemeId: MarkdownThemePreviewId;
const listeners = new Set<() => void>();

export function setMarkdownThemePreviewId(themeId: string | null): void {
  if (previewThemeId === themeId) return;
  previewThemeId = themeId;
  listeners.forEach((listener) => listener());
}

export function clearMarkdownThemePreview(): void {
  if (previewThemeId === undefined) return;
  previewThemeId = undefined;
  listeners.forEach((listener) => listener());
}

export function useEffectiveImportedMarkdownThemeId(
  importedThemeId: string | null
): string | null {
  const previewId = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => previewThemeId,
    () => undefined
  );

  return previewId === undefined ? importedThemeId : previewId;
}
