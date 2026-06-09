import { describe, expect, it } from 'vitest';
import { guessLanguage, MAX_LANGUAGE_DETECTION_CODE_CHARS } from './index';

describe('language detection bounds', () => {
  it('detects ordinary JSON snippets', () => {
    expect(guessLanguage('{"ready":true}')).toBe('json');
  });

  it('skips oversized snippets before detector parsing', () => {
    const oversizedJson = `{"payload":"${'x'.repeat(MAX_LANGUAGE_DETECTION_CODE_CHARS)}"}`;

    expect(guessLanguage(oversizedJson)).toBeNull();
  });
});
