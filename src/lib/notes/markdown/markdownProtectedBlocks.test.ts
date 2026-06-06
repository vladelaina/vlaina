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
