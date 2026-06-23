import { describe, expect, it } from 'vitest';
import {
  normalizeEditorStateMarkdownDocument,
  normalizeSerializedMarkdownDocument,
} from './markdownSerializationUtils';

describe('markdown internal artifact protection', () => {
  it('removes editor blank-line comments outside protected content', () => {
    expect(
      normalizeSerializedMarkdownDocument(['A', '<!--vlaina-markdown-blank-line-->', 'B'].join('\n'))
    ).toBe(['A', '', 'B'].join('\n'));
  });

  it('removes editor-generated rendered HTML boundary helper comments', () => {
    const markdown = [
      '<img src="./assets/demo.svg" alt="Demo" />',
      '',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      'After image.',
    ].join('\n');
    const expected = [
      '<img src="./assets/demo.svg" alt="Demo" />',
      '',
      'After image.',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(expected);
    expect(normalizeEditorStateMarkdownDocument(markdown)).toBe(expected);
  });

  it('preserves user-authored rendered HTML boundary comments outside helper positions', () => {
    const markdown = [
      'Before',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      'After',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
    expect(normalizeEditorStateMarkdownDocument(markdown)).toBe(markdown);
  });

  it('removes case-insensitive internal artifact comments outside protected content', () => {
    expect(
      normalizeSerializedMarkdownDocument(['A', '<!--VLAINA-MARKDOWN-BLANK-LINE-->', 'B'].join('\n'))
    ).toBe(['A', '', 'B'].join('\n'));
    expect(
      normalizeSerializedMarkdownDocument([
        '<img src="./assets/demo.svg" alt="Demo" />',
        '',
        '<!--VLAINA-RENDERED-HTML-BOUNDARY-BLANK-LINE-->',
        'After image.',
      ].join('\n'))
    ).toBe([
      '<img src="./assets/demo.svg" alt="Demo" />',
      '',
      'After image.',
    ].join('\n'));
    expect(
      normalizeSerializedMarkdownDocument(['# Alpha', '', '<!--VLAINA-MARKDOWN-TIGHT-HEADING-->', '', '## Beta'].join('\n'))
    ).toBe(['# Alpha', '## Beta'].join('\n'));
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
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      '<!--vlaina-markdown-tight-heading-->',
      '<br data-vlaina-empty-line="true" />',
      '��VLAINA_LIST_GAP_SENTINEL��',
      '��VLAINA_USER_BR_SENTINEL��',
      '\u0000VLAINA_USER_BR_SENTINEL\u0000',
      '\u2800',
      '```',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves list gap placeholders inside longer fenced code blocks', () => {
    const markdown = [
      '````markdown',
      '```',
      '- before',
      '- \u2800',
      '- after',
      '````',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside long-marker fenced code blocks', () => {
    const marker = '`'.repeat(20_000);
    const markdown = [
      `${marker}markdown`,
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      '- \u2800',
      marker,
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside leading frontmatter', () => {
    const markdown = [
      '---',
      'description: "<!--vlaina-markdown-blank-line-->"',
      'htmlBoundary: "<!--vlaina-rendered-html-boundary-blank-line-->"',
      'gap: "\u2800"',
      'literal: "��VLAINA_LIST_GAP_SENTINEL��"',
      '---',
      '',
      'Body',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like comments inside multiline html comments', () => {
    const blankLineComment = [
      '<!--',
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      '',
      'Body',
    ].join('\n');
    const tightHeadingComment = [
      '<!--',
      '<!--vlaina-markdown-tight-heading-->',
      '',
      'Body',
    ].join('\n');
    const explicitCloseComment = [
      '<!--',
      '<!--vlaina-markdown-tight-heading',
      '-->',
      '',
      'Body',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(blankLineComment)).toBe(blankLineComment);
    expect(normalizeSerializedMarkdownDocument(tightHeadingComment)).toBe(tightHeadingComment);
    expect(normalizeSerializedMarkdownDocument(explicitCloseComment)).toBe(explicitCloseComment);
  });

  it('preserves internal artifact-like text inside raw html blocks', () => {
    const markdown = [
      '<pre>',
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      '<br data-vlaina-empty-line="true" />',
      '��VLAINA_USER_BR_SENTINEL��',
      '</pre>',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text after raw html close-tag text in comments', () => {
    const markdown = [
      '<svg>',
      '<!-- </svg> -->',
      '<![CDATA[</svg>]]>',
      '<br data-vlaina-empty-line="true" />',
      '��VLAINA_USER_BR_SENTINEL��',
      '</svg>',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside source html blocks', () => {
    const markdown = [
      '<source srcset="images/a.webp 1x">',
      '<br data-vlaina-empty-line="true" />',
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
      '',
      'Body',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe(markdown);
  });

  it('preserves internal artifact-like text inside GFM type-7 HTML blocks', () => {
    const markdown = [
      '<custom-element>',
      '<!--vlaina-markdown-blank-line-->',
      '<!--vlaina-rendered-html-boundary-blank-line-->',
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
