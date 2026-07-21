import { describe, expect, it } from 'vitest';
import { fitCodeMirrorCaretToLineHeight } from './codeBlockCaretGeometry';

describe('codeBlockCaretGeometry', () => {
  it('expands and centers a glyph-height cursor inside the rendered line height', () => {
    expect(fitCodeMirrorCaretToLineHeight({
      height: 18,
      lineHeight: 25,
      top: 3.5,
    })).toEqual({
      height: 25,
      top: 0,
    });
  });

  it('leaves a cursor unchanged when it already matches the rendered line height', () => {
    expect(fitCodeMirrorCaretToLineHeight({
      height: 25,
      lineHeight: 25,
      top: 8,
    })).toEqual({
      height: 25,
      top: 8,
    });
  });

  it('keeps the shared minimum for unusually small imported theme line heights', () => {
    expect(fitCodeMirrorCaretToLineHeight({
      height: 11,
      lineHeight: 12,
      top: 5,
    })).toEqual({
      height: 18,
      top: 1.5,
    });
  });
});
