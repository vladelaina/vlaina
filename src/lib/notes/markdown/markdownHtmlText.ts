export function escapeMarkdownHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const NAMED_HTML_TEXT_REFERENCES: Record<string, string> = {
  amp: '&',
  apos: "'",
  colon: ':',
  gt: '>',
  lt: '<',
  nbsp: '\u00A0',
  quot: '"',
};

function decodeMarkdownHtmlReference(value: string): string {
  const match = /^&(#x[0-9a-f]+|#\d+|[A-Za-z][A-Za-z0-9]+);$/i.exec(value);
  if (!match) {
    return value;
  }

  const body = match[1];
  if (body.startsWith('#x') || body.startsWith('#X')) {
    const codePoint = Number.parseInt(body.slice(2), 16);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
      ? String.fromCodePoint(codePoint)
      : value;
  }
  if (body.startsWith('#')) {
    const codePoint = Number.parseInt(body.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10FFFF
      ? String.fromCodePoint(codePoint)
      : value;
  }

  return NAMED_HTML_TEXT_REFERENCES[body.toLowerCase()] ?? value;
}

export function decodeMarkdownHtmlText(value: string): string {
  return value.replace(/&(?:#x[0-9a-f]+|#\d+|[A-Za-z][A-Za-z0-9]+);/gi, decodeMarkdownHtmlReference);
}
