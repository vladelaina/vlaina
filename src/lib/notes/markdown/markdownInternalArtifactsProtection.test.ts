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
      '��VLAINA_LIST_GAP_SENTINEL��',
      '��VLAINA_USER_BR_SENTINEL��',
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
      'literal: "��VLAINA_LIST_GAP_SENTINEL��"',
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
      '��VLAINA_USER_BR_SENTINEL��',
      '</pre>',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside source html blocks', () => {
    const markdown = [
      '<source srcset="images/a.webp 1x">',
      '<br data-vlaina-empty-line="true" />',
      '<!--vlaina-markdown-blank-line-->',
      '',
      'Body',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside GFM type-7 HTML blocks', () => {
    const markdown = [
      '<custom-element>',
      '<!--vlaina-markdown-blank-line-->',
      '<br data-vlaina-empty-line="true" />',
      '��VLAINA_USER_BR_SENTINEL��',
      '</custom-element>',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('removes leaked internal sentinels outside protected content', () => {
    expect(
      normalizeSerializedMarkdownDocument(['A', '��VLAINA_LIST_GAP_SENTINEL��', 'B'].join('\n'))
    ).toBe(['A', '', 'B'].join('\n'));
    expect(
      normalizeSerializedMarkdownDocument(['A', '��VLAINA_USER_BR_SENTINEL��', 'B'].join('\n'))
    ).toBe(['A\\', 'B'].join('\n'));
  });
});
