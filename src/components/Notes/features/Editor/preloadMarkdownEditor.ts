let markdownEditorImportPromise: Promise<typeof import('./index')> | null = null;

export function preloadMarkdownEditor() {
  if (!markdownEditorImportPromise) {
    markdownEditorImportPromise = import('./index');
  }

  return markdownEditorImportPromise;
}
