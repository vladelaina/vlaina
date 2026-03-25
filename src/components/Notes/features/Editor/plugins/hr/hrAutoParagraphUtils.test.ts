import { describe, expect, it } from 'vitest';
import { isThematicBreakPattern, shouldConvertLineToThematicBreak } from './hrAutoParagraphUtils';

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

describe('shouldConvertLineToThematicBreak', () => {
  it('returns true when newly typed character completes a valid break', () => {
    expect(shouldConvertLineToThematicBreak('--', 2, '-')).toBe(true);
    expect(shouldConvertLineToThematicBreak('**', 2, '*')).toBe(true);
    expect(shouldConvertLineToThematicBreak('__', 2, '_')).toBe(true);
  });

  it('returns false when line still does not form a break', () => {
    expect(shouldConvertLineToThematicBreak('a--', 3, '-')).toBe(false);
    expect(shouldConvertLineToThematicBreak('**', 2, '-')).toBe(false);
    expect(shouldConvertLineToThematicBreak('__', 2, '.')).toBe(false);
  });
});
