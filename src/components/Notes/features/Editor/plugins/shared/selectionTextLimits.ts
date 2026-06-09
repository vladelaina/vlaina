export const MAX_EDITOR_SELECTION_TEXT_CHARS = 1024 * 1024;

export function isEditorTextRangeTooLarge(
  from: number,
  to: number,
  maxChars = MAX_EDITOR_SELECTION_TEXT_CHARS,
): boolean {
  return Math.max(0, to - from) > maxChars;
}

export function getBoundedTextBetween(
  doc: {
    content?: { size?: number };
    textBetween: (from: number, to: number, blockSeparator?: string | null, leafText?: string | null) => string;
  },
  from: number,
  to: number,
  blockSeparator?: string | null,
  leafText?: string | null,
  maxChars = MAX_EDITOR_SELECTION_TEXT_CHARS,
): string {
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : to;
  const safeFrom = Math.max(0, Math.min(from, docSize));
  const safeTo = Math.max(safeFrom, Math.min(to, docSize, safeFrom + maxChars));
  return doc.textBetween(safeFrom, safeTo, blockSeparator, leafText);
}
