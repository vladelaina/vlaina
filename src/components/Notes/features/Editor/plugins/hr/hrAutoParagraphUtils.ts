const THEMATIC_BREAK_PATTERN = /^(\s*)([-*_])(?:\s*\2){2,}\s*$/;

export function isThematicBreakPattern(text: string): boolean {
  return THEMATIC_BREAK_PATTERN.test(text);
}

export function shouldConvertParagraphToThematicBreak(
  lineText: string,
  cursorOffset: number,
): boolean {
  return cursorOffset === lineText.length && isThematicBreakPattern(lineText);
}
