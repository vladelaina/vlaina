export function stripMarkdownLinks(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1');
}

export function stripMarkdownInline(value: string): string {
  return stripMarkdownLinks(value)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\+\+([^+]+)\+\+/g, '$1')
    .replace(/(?<!\^)\^([^^\s](?:[^^]*?[^^\s])?)\^(?!\^)/g, '$1')
    .replace(/(?<!~)~([^~\s](?:[^~]*?[^~\s])?)~(?!~)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export function normalizeMarkdownInlineTextForMeasurement(value: string): string {
  return stripMarkdownLinks(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
