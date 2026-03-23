import { describe, expect, it } from 'vitest';
import {
  getMathBlockLatexFromInputMatch,
  isMathBlockShortcutText,
  MATH_BLOCK_INPUT_RULE_PATTERN,
} from './mathBlockFence';

describe('mathBlockFence', () => {
  it('matches standard dollar block fences', () => {
    const match = '$$x^2$$ '.match(MATH_BLOCK_INPUT_RULE_PATTERN);

    expect(getMathBlockLatexFromInputMatch(match as RegExpMatchArray)).toBe('x^2');
  });

  it('matches localized fullwidth and yen-style block fences', () => {
    const fullWidthMatch = '￥￥\\frac{1}{2}￥￥ '.match(MATH_BLOCK_INPUT_RULE_PATTERN);
    const yenMatch = '¥¥x+y¥¥ '.match(MATH_BLOCK_INPUT_RULE_PATTERN);
    const fullWidthDollarMatch = '＄＄z＄＄ '.match(MATH_BLOCK_INPUT_RULE_PATTERN);

    expect(getMathBlockLatexFromInputMatch(fullWidthMatch as RegExpMatchArray)).toBe('\\frac{1}{2}');
    expect(getMathBlockLatexFromInputMatch(yenMatch as RegExpMatchArray)).toBe('x+y');
    expect(getMathBlockLatexFromInputMatch(fullWidthDollarMatch as RegExpMatchArray)).toBe('z');
  });

  it('rejects mixed markers and bare shortcut text in the input-rule pattern', () => {
    expect('$￥x$￥ '.match(MATH_BLOCK_INPUT_RULE_PATTERN)).toBeNull();
    expect('$$ '.match(MATH_BLOCK_INPUT_RULE_PATTERN)).toBeNull();
  });

  it('recognizes shortcut-only paragraph text for enter conversion', () => {
    expect(isMathBlockShortcutText('$$')).toBe(true);
    expect(isMathBlockShortcutText(' ￥￥ ')).toBe(true);
    expect(isMathBlockShortcutText('¥¥')).toBe(true);
    expect(isMathBlockShortcutText('＄＄')).toBe(true);
  });

  it('does not treat other text as a shortcut-only paragraph', () => {
    expect(isMathBlockShortcutText('$')).toBe(false);
    expect(isMathBlockShortcutText('$$x')).toBe(false);
    expect(isMathBlockShortcutText('$￥')).toBe(false);
    expect(isMathBlockShortcutText('text')).toBe(false);
  });
});
