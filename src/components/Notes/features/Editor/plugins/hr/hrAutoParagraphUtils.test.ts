import { describe, expect, it } from 'vitest';
import { isThematicBreakPattern, shouldConvertParagraphToThematicBreak } from './hrAutoParagraphUtils';

describe('isThematicBreakPattern', () => {
  it('matches markdown thematic breaks', () => {
    expect(isThematicBreakPattern('---')).toBe(true);
    expect(isThematicBreakPattern('***')).toBe(true);
    expect(isThematicBreakPattern('___')).toBe(true);
    expect(isThematicBreakPattern('- - -')).toBe(true);
    expect(isThematicBreakPattern('  * * *  ')).toBe(true);
  });

  it('rejects non-thematic-break text', () => {
    expect(isThematicBreakPattern('--')).toBe(false);
    expect(isThematicBreakPattern('ab---')).toBe(false);
    expect(isThematicBreakPattern('-*-')).toBe(false);
    expect(isThematicBreakPattern('_ _ -')).toBe(false);
  });
});

describe('shouldConvertParagraphToThematicBreak', () => {
  it('returns true for standalone thematic break text when the cursor is at the end', () => {
    expect(shouldConvertParagraphToThematicBreak('---', 3)).toBe(true);
    expect(shouldConvertParagraphToThematicBreak('***', 3)).toBe(true);
    expect(shouldConvertParagraphToThematicBreak('___', 3)).toBe(true);
  });

  it('returns false when the cursor is not at the end or the text is not standalone', () => {
    expect(shouldConvertParagraphToThematicBreak('---', 2)).toBe(false);
    expect(shouldConvertParagraphToThematicBreak('---text---', 10)).toBe(false);
    expect(shouldConvertParagraphToThematicBreak('**', 2)).toBe(false);
  });
});
