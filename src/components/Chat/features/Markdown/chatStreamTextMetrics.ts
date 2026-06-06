export function getCodePointLength(text: string): number {
  let length = 0;
  for (const char of text) {
    if (char.length === 0) {
      continue;
    }
    length += 1;
  }
  return length;
}

export function createFilledCodePointTimings(text: string, value: number): number[] {
  return Array(getCodePointLength(text)).fill(value);
}
