import { describe, expect, it } from 'vitest';
import { isMarkdownImageOnlyLine } from './markdownImageLine';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
} from './markdownSerializationUtils';

const MARKDOWN_BLANK_LINE_PLACEHOLDER = '<!--vlaina-markdown-blank-line-->';

describe('markdown image line helpers', () => {
  it('recognizes standalone markdown image lines with nested labels and parenthesized targets', () => {
    expect(
      isMarkdownImageOnlyLine('![outer [nested] label](assets/file(one).png "Demo title")')
    ).toBe(true);
    expect(
      isMarkdownImageOnlyLine('  ![alt `](not target)`](<assets/file(one).png>)  ')
    ).toBe(true);
    expect(
      isMarkdownImageOnlyLine('![angle](<assets/file) with space.png> "Demo title")')
    ).toBe(true);
  });

  it('rejects escaped, indented, and inline markdown image text', () => {
    expect(isMarkdownImageOnlyLine('\\![alt](image.png)')).toBe(false);
    expect(isMarkdownImageOnlyLine('    ![alt](image.png)')).toBe(false);
    expect(isMarkdownImageOnlyLine('before ![alt](image.png)')).toBe(false);
    expect(isMarkdownImageOnlyLine('[link](image.png)')).toBe(false);
  });

  it('handles long escaped bracket runs without repeated backslash scans', () => {
    const escapedBrackets = Array.from({ length: 500 }, () => '\\]').join('');

    expect(isMarkdownImageOnlyLine(`![${escapedBrackets}](image.png)`)).toBe(true);
    expect(isMarkdownImageOnlyLine(`${'\\'.repeat(501)}![alt](image.png)`)).toBe(false);
  });

  it('keeps structural blank lines after complex markdown images during editor input', () => {
    const markdown = [
      '![outer [nested] label](assets/file(one).png "Demo title")',
      '',
      '',
      '# Next',
    ].join('\n');

    expect(preserveMarkdownBlankLinesForEditor(markdown)).toBe([
      '![outer [nested] label](assets/file(one).png "Demo title")',
      '',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '# Next',
    ].join('\n'));
    expect(normalizeSerializedMarkdownDocument(preserveMarkdownBlankLinesForEditor(markdown))).toBe(markdown);
  });

  it('keeps structural blank lines after complex markdown images during serialization cleanup', () => {
    const markdown = [
      '![outer [nested] label](assets/file(one).png "Demo title")',
      '',
      MARKDOWN_BLANK_LINE_PLACEHOLDER,
      '# Next',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe([
      '![outer [nested] label](assets/file(one).png "Demo title")',
      '',
      '',
      '# Next',
    ].join('\n'));
  });
});
