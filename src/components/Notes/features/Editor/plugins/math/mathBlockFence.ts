const MATH_BLOCK_MARKER_ALTERNATION = ['\\$', '¥', '￥', '＄', '﹩'].join('|');
const MATH_BLOCK_MARKER_CLASS = '$¥￥＄﹩';

export const MATH_BLOCK_INPUT_RULE_PATTERN = new RegExp(
  `^(${MATH_BLOCK_MARKER_ALTERNATION})\\1([^${MATH_BLOCK_MARKER_CLASS}]+)\\1\\1\\s$`,
  'u'
);

const MATH_BLOCK_SHORTCUT_PATTERN = new RegExp(
  `^(${MATH_BLOCK_MARKER_ALTERNATION})\\1$`,
  'u'
);

export function getMathBlockLatexFromInputMatch(match: RegExpMatchArray): string {
  return match[2] || '';
}

export function isMathBlockShortcutText(text: string): boolean {
  return MATH_BLOCK_SHORTCUT_PATTERN.test(text.trim());
}
