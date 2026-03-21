export function normalizeSelectedTextForComposer(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .trim();
}
