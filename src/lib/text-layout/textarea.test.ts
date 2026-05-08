import { describe, expect, it } from 'vitest';
import { measureTextareaContentHeight } from './textarea';

describe('measureTextareaContentHeight', () => {
  const options = {
    font: '400 15px sans-serif',
    lineHeight: 24,
    minHeight: 24,
    maxHeight: 320,
  };

  it('counts a trailing newline as a visible empty textarea line', () => {
    expect(measureTextareaContentHeight('hello\n', 320, options)).toBe(
      measureTextareaContentHeight('hello', 320, options) + options.lineHeight,
    );
  });

  it('counts the final trailing newline after existing blank lines', () => {
    expect(measureTextareaContentHeight('hello\n\n', 320, options)).toBe(
      measureTextareaContentHeight('hello', 320, options) + options.lineHeight * 2,
    );
  });
});
