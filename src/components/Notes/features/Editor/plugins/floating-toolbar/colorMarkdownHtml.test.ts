import { describe, expect, it } from 'vitest';
import { sanitizeCssColorValue } from './colorMarkdownHtml';

describe('color markdown html security', () => {
  it('keeps safe color values used by note color marks', () => {
    expect(sanitizeCssColorValue('#123456')).toBe('#123456');
    expect(sanitizeCssColorValue('rgb(12, 34, 56)')).toBe('rgb(12, 34, 56)');
    expect(sanitizeCssColorValue('var(--note-color)')).toBe('var(--note-color)');
    expect(sanitizeCssColorValue('red')).toBe('red');
  });

  it('rejects css values that can carry extra declarations or resource loads', () => {
    expect(sanitizeCssColorValue('red; background-image: url(https://example.com/pixel.png)')).toBeNull();
    expect(sanitizeCssColorValue('url(https://example.com/pixel.png)')).toBeNull();
    expect(sanitizeCssColorValue('expression(alert(1))')).toBeNull();
    expect(sanitizeCssColorValue('red" onclick="alert(1)')).toBeNull();
  });
});
