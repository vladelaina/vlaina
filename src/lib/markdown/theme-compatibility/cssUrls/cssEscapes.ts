export function decodeCssEscapesForUrl(value: string): string {
  return value.replace(/\\([0-9a-f]{1,6}\s?|[\s\S])/gi, (_match, escaped: string) => {
    if (/^[0-9a-f]/i.test(escaped)) {
      const codePoint = Number.parseInt(escaped.trim(), 16);
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) {
        return '';
      }
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return '';
      }
    }

    if (escaped === '\n' || escaped === '\r') {
      return '';
    }

    return escaped;
  });
}
