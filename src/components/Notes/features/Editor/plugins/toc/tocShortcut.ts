export function isTocShortcutText(text: string): boolean {
  return /^(?:\[toc\]|\{:toc\})$/i.test(text.trim());
}
