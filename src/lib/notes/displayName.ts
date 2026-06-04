import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from './markdownFile';

export function getNoteTitleFromPath(path: string | undefined): string {
  if (!path) return 'Untitled';

  const normalizedPath = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const fileName = normalizedPath.split('/').filter(Boolean).pop();
  const title = fileName ? stripMarkdownExtension(fileName) : undefined;

  return title || 'Untitled';
}

export function stripMarkdownExtension(name: string): string {
  return stripSupportedMarkdownExtension(name);
}

export function ensureMarkdownFileName(name: string): string {
  const normalized = name.trim();
  if (isSupportedMarkdownPath(normalized)) {
    return normalized;
  }
  return normalized ? `${normalized}.md` : 'Untitled.md';
}

export function normalizeNotePathKey(path: string | undefined): string | undefined {
  if (!path) return undefined;

  if (path === '') return '';

  const slashPath = path.replace(/\\/g, '/');
  const uncRest = slashPath.startsWith('//') && !slashPath.startsWith('///')
    ? slashPath.slice(2).replace(/\/{2,}/g, '/').replace(/\/+$/, '')
    : null;
  const uncParts = uncRest?.split('/').filter(Boolean) ?? [];
  const compactedPath = uncParts.length >= 2
    ? `//${uncParts.join('/')}`
    : slashPath.replace(/\/{2,}/g, '/');

  if (compactedPath === '/') return '/';

  const normalizedPath = compactedPath.replace(/\/+$/, '');

  return normalizedPath;
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
