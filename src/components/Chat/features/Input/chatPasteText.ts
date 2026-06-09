export const MAX_CHAT_PASTE_MULTILINE_SCAN_CHARS = 256 * 1024;

export function shouldMarkPastedTextMultiline(text: string): boolean {
  const scanLength = Math.min(text.length, MAX_CHAT_PASTE_MULTILINE_SCAN_CHARS);
  for (let index = 0; index < scanLength; index += 1) {
    if (text.charCodeAt(index) === 10) {
      return true;
    }
  }
  return text.length > MAX_CHAT_PASTE_MULTILINE_SCAN_CHARS;
}
