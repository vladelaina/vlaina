const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdown', 'mkd']);

export function isSupportedMarkdownPath(path: string): boolean {
  const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0) {
    return false;
  }

  return MARKDOWN_EXTENSIONS.has(name.slice(dotIndex + 1).toLowerCase());
}

export function ensureSupportedMarkdownPath(path: string): void {
  if (!isSupportedMarkdownPath(path)) {
    throw new Error('Only Markdown files can be opened as notes.');
  }
}
