import { describe, expect, it } from 'vitest';
import { normalizeSerializedMarkdownDocument } from '@/lib/notes/markdown/markdownSerializationUtils';

describe('markdown serialization frontmatter', () => {
  it('does not normalize markdown-like syntax inside leading YAML frontmatter', () => {
    const markdown = [
      '---',
      'title: Alpha',
      'url: http\\://example.test:8317',
      'items:',
      '  -苹果',
      'table: ｜ A ｜ B ｜',
      '---',
      '',
      '1.正文',
      '2.继续',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe([
      '---',
      'title: Alpha',
      'url: http\\://example.test:8317',
      'items:',
      '  -苹果',
      'table: ｜ A ｜ B ｜',
      '---',
      '',
      '1. 正文',
      '2. 继续',
    ].join('\n'));
  });

  it('does not normalize markdown-like syntax inside BOM-prefixed leading YAML frontmatter', () => {
    const markdown = [
      '\uFEFF---',
      'title: Alpha',
      'url: http\\://example.test:8317',
      'items:',
      '  -苹果',
      '---',
      '',
      '1.正文',
      '2.继续',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe([
      '---',
      'title: Alpha',
      'url: http\\://example.test:8317',
      'items:',
      '  -苹果',
      '---',
      '',
      '1. 正文',
      '2. 继续',
    ].join('\n'));
  });

  it('removes a UTF-8 BOM from markdown without frontmatter', () => {
    expect(normalizeSerializedMarkdownDocument('\uFEFF# Title')).toBe('# Title');
  });

  it('normalizes content between indented frontmatter-like delimiters as normal markdown', () => {
    const markdown = [
      ' ---',
      'url: http\\://example.test',
      ' ---',
      '',
      '1.正文',
      '2.继续',
    ].join('\n');

    expect(normalizeSerializedMarkdownDocument(markdown)).toBe([
      ' ---',
      'url: http://example.test',
      ' ---',
      '',
      '1. 正文',
      '2. 继续',
    ].join('\n'));
  });
});
