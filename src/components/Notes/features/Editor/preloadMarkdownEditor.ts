let markdownEditorImportPromise: Promise<typeof import('./index')> | null = null;
let milkdownEditorRuntimeImportPromise: Promise<typeof import('./MilkdownEditorInner')> | null = null;

export function preloadMarkdownEditor() {
  if (!markdownEditorImportPromise) {
    markdownEditorImportPromise = import('./index');
  }

  if (!milkdownEditorRuntimeImportPromise) {
    milkdownEditorRuntimeImportPromise = import('./MilkdownEditorInner');
  }

  return markdownEditorImportPromise;
}
