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
});
