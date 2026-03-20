import { describe, expect, it } from 'vitest';
import {
  computeCodeBlockChange,
  mapDocumentOffsetToCodeBlockEditorOffset,
  mapCodeBlockEditorOffsetToDocumentOffset,
  normalizeCodeBlockEditorText,
} from './codeBlockEditorUtils';

describe('codeBlockEditorUtils', () => {
  it('normalizes CRLF and CR line endings to LF', () => {
    expect(normalizeCodeBlockEditorText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('does not produce a change for line-ending-only differences after normalization', () => {
    const currentValue = 'const a = 1;\nconst b = 2;\n';
    const externalValue = 'const a = 1;\r\nconst b = 2;\r\n';

    expect(
      computeCodeBlockChange(
        currentValue,
        normalizeCodeBlockEditorText(externalValue)
      )
    ).toBeNull();
  });

  it('maps normalized LF offsets back to CRLF document offsets', () => {
    const rawValue = 'a\r\nb\r\ncd';

    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 0)).toBe(0);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 1)).toBe(1);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 2)).toBe(3);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 3)).toBe(4);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 4)).toBe(6);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 5)).toBe(7);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 6)).toBe(8);
  });

  it('maps standalone CR offsets and clamps past the normalized text length', () => {
    const rawValue = 'a\rb\rc';

    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 0)).toBe(0);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 1)).toBe(1);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 2)).toBe(2);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 3)).toBe(3);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 4)).toBe(4);
    expect(mapCodeBlockEditorOffsetToDocumentOffset(rawValue, 99)).toBe(5);
  });

  it('maps raw document offsets back into normalized editor offsets', () => {
    const rawValue = 'a\r\nb\r\ncd';

    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 0)).toBe(0);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 1)).toBe(1);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 2)).toBe(2);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 3)).toBe(2);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 4)).toBe(3);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 5)).toBe(4);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 6)).toBe(4);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 7)).toBe(5);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 8)).toBe(6);
    expect(mapDocumentOffsetToCodeBlockEditorOffset(rawValue, 99)).toBe(6);
  });

  it('computes focused middle replacements without disturbing shared prefix or suffix', () => {
    expect(computeCodeBlockChange('hello world', 'hello brave world')).toEqual({
      from: 6,
      to: 6,
      text: 'brave ',
    });

    expect(computeCodeBlockChange('hello brave world', 'hello world')).toEqual({
      from: 6,
      to: 12,
      text: '',
    });
  });
});
