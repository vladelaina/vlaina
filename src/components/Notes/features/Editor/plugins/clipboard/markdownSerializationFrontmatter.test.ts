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
});
