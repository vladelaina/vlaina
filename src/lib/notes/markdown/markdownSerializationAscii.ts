export function containsAsciiCaseInsensitive(text: string, needle: string): boolean {
  const needleLength = needle.length;
  if (needleLength === 0) return true;

  const firstNeedleCode = toAsciiLowerCode(needle.charCodeAt(0));
  const lastStart = text.length - needleLength;
  for (let index = 0; index <= lastStart; index += 1) {
    if (toAsciiLowerCode(text.charCodeAt(index)) !== firstNeedleCode) continue;

    let matches = true;
    for (let offset = 1; offset < needleLength; offset += 1) {
      if (
        toAsciiLowerCode(text.charCodeAt(index + offset))
        !== toAsciiLowerCode(needle.charCodeAt(offset))
      ) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

export function toAsciiLowerCode(code: number): number {
  return code >= 65 && code <= 90 ? code + 32 : code;
}
