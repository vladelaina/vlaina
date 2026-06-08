import { describe, expect, it } from 'vitest';
import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';

describe('markdown protected blocks', () => {
  it('does not transform leading YAML frontmatter', () => {
    const markdown = [
      '---',
      'title: Alpha',
      'url: http\\://example.test',
      'items:',
      '  -苹果',
      '---',
      '',
      '-香蕉',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe([
      '---',
      'title: Alpha',
      'url: http\\://example.test',
      'items:',
      '  -苹果',
      '---',
      '',
      '*香蕉',
    ].join('\n'));
  });

  it('treats unmatched leading frontmatter delimiters as normal markdown', () => {
    const markdown = ['---', 'Body'].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/---/g, '***'))
    ).toBe(['***', 'Body'].join('\n'));
  });

  it('does not transform fenced code blocks and resumes after the closing fence', () => {
    const markdown = [
      'Before - item',
      '```ts',
      'const value = "- hidden";',
      '````',
      'After - item',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe([
      'Before * item',
      '```ts',
      'const value = "- hidden";',
      '````',
      'After * item',
    ].join('\n'));
  });

  it('protects raw text and sanitizer-dropped HTML block contents', () => {
    const markdown = [
      'Before - item',
      '<svg>',
      '- hidden',
      '</svg>',
      '<math>',
      '- hidden',
      '</math>',
      '<noscript>',
      '- hidden',
      '</noscript>',
      '<xmp>',
      '- hidden',
      '</xmp>',
      'After - item',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe([
      'Before * item',
      '<svg>',
      '- hidden',
      '</svg>',
      '<math>',
      '- hidden',
      '</math>',
      '<noscript>',
      '- hidden',
      '</noscript>',
      '<xmp>',
      '- hidden',
      '</xmp>',
      'After * item',
    ].join('\n'));
  });

  it('resumes transforms after raw HTML close tags with attributes or whitespace', () => {
    const markdown = [
      'Before - item',
      '<svg>',
      '- hidden',
      '</svg data-extra="ignored">',
      'After - item',
      '<math>',
      '- hidden',
      '</math >',
      'Done - item',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe([
      'Before * item',
      '<svg>',
      '- hidden',
      '</svg data-extra="ignored">',
      'After * item',
      '<math>',
      '- hidden',
      '</math >',
      'Done * item',
    ].join('\n'));
  });

  it('does not close raw HTML blocks on close-tag text inside non-tag HTML ranges', () => {
    const markdown = [
      'Before - item',
      '<svg>',
      '<!-- </svg> -->',
      '<![CDATA[</svg>]]>',
      '<!bogus </svg>>',
      '- hidden',
      '</svg>',
      'After - item',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe([
      'Before * item',
      '<svg>',
      '<!-- </svg> -->',
      '<![CDATA[</svg>]]>',
      '<!bogus </svg>>',
      '- hidden',
      '</svg>',
      'After * item',
    ].join('\n'));
  });

  it('protects plaintext HTML blocks through the document end', () => {
    const markdown = [
      'Before - item',
      '<plaintext>',
      '- hidden',
      '</plaintext>',
      'After - hidden',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe(markdown.replace('Before - item', 'Before * item'));
  });

  it('protects GFM source HTML blocks until a blank line', () => {
    const markdown = [
      'Before - item',
      '<source srcset="images/a.webp 1x">',
      '- hidden',
      '',
      'After - item',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe([
      'Before * item',
      '<source srcset="images/a.webp 1x">',
      '- hidden',
      '',
      'After * item',
    ].join('\n'));
  });

  it('treats oversized leading frontmatter candidates as normal markdown', () => {
    const markdown = [
      '---',
      ...Array.from({ length: 2050 }, (_, index) => `line_${index}: value`),
      '---',
      '- Item',
    ].join('\n');

    const expected = [
      '***',
      ...Array.from({ length: 2050 }, (_, index) => `line_${index}: value`),
      '***',
      '* Item',
    ].join('\n');

    expect(
      mapMarkdownOutsideProtectedSegments(markdown, (segment) => segment.replace(/-/g, '*'))
    ).toBe(expected);
  });
});
