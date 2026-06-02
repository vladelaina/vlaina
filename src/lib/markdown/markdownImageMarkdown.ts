export function escapeMarkdownImageAlt(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

export function escapeMarkdownAngleDestination(value: string, options: { stripWhitespace?: boolean } = {}): string {
  const normalized = options.stripWhitespace ? value.replace(/\s+/g, '') : value;
  return normalized.replace(/[\u0000-\u001F\u007F<>]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
  );
}

export function formatMarkdownImage(src: string, alt = 'image', options: { stripDestinationWhitespace?: boolean } = {}): string {
  const destination = escapeMarkdownAngleDestination(src, {
    stripWhitespace: options.stripDestinationWhitespace,
  });
  return `![${escapeMarkdownImageAlt(alt)}](<${destination}>)`;
}
