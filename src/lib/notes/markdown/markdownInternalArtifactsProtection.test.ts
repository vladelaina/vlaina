import { describe, expect, it } from 'vitest';
import { normalizeSerializedMarkdownDocument } from './markdownSerializationUtils';

describe('markdown internal artifact protection', () => {
  it('removes editor blank-line comments outside protected content', () => {
    expect(
      normalizeSerializedMarkdownDocument(['A', '<!--vlaina-markdown-blank-line-->', 'B'].join('\n'))
    ).toBe(['A', '', 'B'].join('\n'));
  });

  it('removes editor tight-heading comments outside protected content', () => {
    expect(
      normalizeSerializedMarkdownDocument(['# Alpha', '', '<!--vlaina-markdown-tight-heading-->', '', '## Beta'].join('\n'))
    ).toBe(['# Alpha', '## Beta'].join('\n'));
  });

  it('preserves internal artifact-like text inside fenced code', () => {
    const markdown = [
      '```html',
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-markdown-tight-heading-->',
      '<br data-vlaina-empty-line="true" />',
      '\u2800',
      '```',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside leading frontmatter', () => {
    const markdown = [
      '---',
      'description: "<!--vlaina-markdown-blank-line-->"',
      'gap: "\u2800"',
      '---',
      '',
      'Body',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside raw html blocks', () => {
    const markdown = [
      '<pre>',
      '<!--vlaina-markdown-blank-line-->',
      '<br data-vlaina-empty-line="true" />',
      '</pre>',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });
});
