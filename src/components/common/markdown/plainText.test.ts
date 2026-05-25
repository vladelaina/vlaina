import { describe, expect, it } from 'vitest';
import {
  normalizeMarkdownInlineTextForMeasurement,
  stripMarkdownInline,
} from './plainText';

describe('markdown plain text helpers', () => {
  it('strips standard and Notes inline markdown for plain-text exports', () => {
    expect(stripMarkdownInline(
      '**bold** _em_ `code` ~~strike~~ ==mark== ++under++ H~2~O x^2^ [link](https://example.com) ![alt](asset://image)'
    )).toBe('bold em code strike mark under H2O x2 link alt');
  });

  it('normalizes inline markdown for measurement without removing visible text', () => {
    expect(normalizeMarkdownInlineTextForMeasurement(
      '![diagram](asset://image)\n<a>safe</a> escaped\\*word\\*'
    )).toBe('diagram safe escaped*word*');
  });
});
