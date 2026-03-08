export function getNoteTitleFromPath(path: string | undefined): string {
  if (!path) return 'Untitled';

  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const fileName = normalizedPath.split('/').filter(Boolean).pop();
  const title = fileName ? stripMarkdownExtension(fileName) : undefined;

  return title || 'Untitled';
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(/\.md$/i, '');
}

export function ensureMarkdownFileName(name: string): string {
  const normalized = stripMarkdownExtension(name.trim());
  return normalized ? `${normalized}.md` : 'Untitled.md';
}

export function normalizeNotePathKey(path: string | undefined): string | undefined {
  if (!path) return undefined;

  const normalizedPath = path
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');

  return normalizedPath || '/';
}

export function resolveNoteDisplayName(
  path: string | undefined,
  displayName: string | undefined,
  previewTitle?: string
): string | undefined {
  if (!path) return undefined;

  const nextPreviewTitle = previewTitle?.trim();
  if (nextPreviewTitle) return nextPreviewTitle;

  const nextDisplayName = displayName?.trim();
  if (nextDisplayName) return nextDisplayName;

  return getNoteTitleFromPath(path);
}
