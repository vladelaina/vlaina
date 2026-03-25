const THEMATIC_BREAK_PATTERN = /^(\s*)([-*_])(?:\s*\2){2,}\s*$/;

export function isThematicBreakPattern(text: string): boolean {
  return THEMATIC_BREAK_PATTERN.test(text);
}

export function shouldConvertLineToThematicBreak(
  lineText: string,
  insertOffset: number,
  inputChar: string,
): boolean {
  if (inputChar !== '-' && inputChar !== '*' && inputChar !== '_') return false;

  const nextText = `${lineText.slice(0, insertOffset)}${inputChar}${lineText.slice(insertOffset)}`;
  return isThematicBreakPattern(nextText);
}
