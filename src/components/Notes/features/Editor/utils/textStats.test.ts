import { describe, expect, it } from 'vitest';
import { calculateTextStats } from './textStats';

describe('calculateTextStats', () => {
  it('returns zero stats for empty content', () => {
    expect(calculateTextStats('')).toEqual({
      lineCount: 0,
      wordCount: 0,
      characterCount: 0,
    });
  });

  it('counts lines, words, and characters for plain text', () => {
    const input = 'alpha beta\ngamma';
    const stats = calculateTextStats(input);

    expect(stats.lineCount).toBe(2);
    expect(stats.wordCount).toBe(3);
    expect(stats.characterCount).toBe(Array.from(input).length);
  });

  it('ignores extra spaces when counting words', () => {
    const input = '   one   two    three   ';
    const stats = calculateTextStats(input);

    expect(stats.lineCount).toBe(1);
    expect(stats.wordCount).toBe(3);
  });
});
