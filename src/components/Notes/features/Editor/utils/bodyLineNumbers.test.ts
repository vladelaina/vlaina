import { describe, expect, it } from 'vitest';
import { getMarkdownBodySourceLineNumbers } from './bodyLineNumbers';

describe('getMarkdownBodySourceLineNumbers', () => {
  it('counts hidden leading frontmatter lines without showing frontmatter labels', () => {
    const markdown = [
      '---',
      'vlaina_created: 2026-01-01T00:00:00.000Z',
      'vlaina_updated: 2026-01-02T00:00:00.000Z',
      '---',
      '',
      '# Title',
      '',
      'Body',
    ].join('\n');

    expect(getMarkdownBodySourceLineNumbers(markdown)).toEqual([6, 8]);
  });

  it('skips fenced code blocks while preserving following source line numbers', () => {
    const markdown = [
      '# Title',
      '',
      '```ts',
      'const value = 1;',
      '```',
      '',
      'After code',
    ].join('\n');

    expect(getMarkdownBodySourceLineNumbers(markdown)).toEqual([1, 7]);
  });

  it('skips internal blank line placeholders while preserving following source line numbers', () => {
    const markdown = [
      '# Title',
      '<!--vlaina-markdown-blank-line-->',
      '<!-- vlaina-rendered-html-boundary-blank-line -->',
      'Body',
    ].join('\n');

    expect(getMarkdownBodySourceLineNumbers(markdown)).toEqual([1, 4]);
  });

  it('treats internal blank line placeholders as paragraph boundaries', () => {
    const markdown = [
      'Before placeholder',
      '<!--vlaina-markdown-blank-line-->',
      'After placeholder',
    ].join('\n');

    expect(getMarkdownBodySourceLineNumbers(markdown)).toEqual([1, 3]);
  });

  it('returns source line numbers for list items and nested list items', () => {
    const markdown = [
      '- One',
      '  continuation',
      '  - Nested',
      '- Two',
    ].join('\n');

    expect(getMarkdownBodySourceLineNumbers(markdown)).toEqual([1, 3, 4]);
  });
});
