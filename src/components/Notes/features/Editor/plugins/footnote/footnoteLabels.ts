const MAX_FOOTNOTE_LABEL_CHARS = 128;
const MAX_FOOTNOTE_PREVIEW_CHARS = 512;
const UNSAFE_FOOTNOTE_LABEL_CHARS = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD[\]]/g;

export function normalizeFootnoteLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(UNSAFE_FOOTNOTE_LABEL_CHARS, '')
    .trim()
    .slice(0, MAX_FOOTNOTE_LABEL_CHARS);
}

export function normalizeFootnotePreview(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_FOOTNOTE_PREVIEW_CHARS).trim();
}
