const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd']);

export function getSupportedMarkdownExtension(path: string): string | null {
  const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return null;
  }

  const extension = name.slice(dotIndex + 1).toLowerCase();
  return MARKDOWN_EXTENSIONS.has(extension) ? extension : null;
}

export function isSupportedMarkdownPath(path: string): boolean {
  return getSupportedMarkdownExtension(path) != null;
}

export function stripSupportedMarkdownExtension(name: string): string {
  const extension = getSupportedMarkdownExtension(name);
  if (!extension) {
    return name;
  }

  return name.slice(0, -(extension.length + 1));
}

export function ensureSupportedMarkdownPath(path: string): void {
  if (!isSupportedMarkdownPath(path)) {
    throw new Error('Only Markdown files can be opened as notes.');
  }
}
