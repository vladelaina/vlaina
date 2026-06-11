import { describe, expect, it, vi } from 'vitest';
import {
  MAX_ASSISTANT_MARKDOWN_MEASUREMENT_BLOCKS,
  MAX_ASSISTANT_MARKDOWN_MEASUREMENT_SCAN_CHARS,
  parseMarkdownMeasurementBlocks,
} from './chatAssistantMarkdownBlockParser';

describe('parseMarkdownMeasurementBlocks', () => {
  it('keeps shorter same-marker fence lines inside code blocks', () => {
    const blocks = parseMarkdownMeasurementBlocks([
      '````ts',
      '```',
      '',
      'const value = 1;',
      '````',
      '',
      'After',
    ].join('\n'));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      kind: 'code',
      code: ['```', '', 'const value = 1;'].join('\n'),
    });
    expect(blocks[1]?.kind).toBe('text');
  });

  it('does not close a code block with a fence-like content line', () => {
    const blocks = parseMarkdownMeasurementBlocks([
      '```ts',
      '```not close',
      '',
      'const value = 1;',
      '```',
    ].join('\n'));

    expect(blocks).toEqual([
      {
        kind: 'code',
        code: ['```not close', '', 'const value = 1;'].join('\n'),
        widthInset: 0,
      },
    ]);
  });

  it('normalizes CRLF and CR line breaks while parsing code blocks', () => {
    expect(parseMarkdownMeasurementBlocks('```ts\r\nconst value = 1;\rvalue += 1;\r\n```')).toEqual(
      parseMarkdownMeasurementBlocks('```ts\nconst value = 1;\nvalue += 1;\n```'),
    );
  });

  it('does not materialize a full line array for code-only markdown', () => {
    const replaceSpy = vi.spyOn(String.prototype, 'replace');
    const splitSpy = vi.spyOn(String.prototype, 'split');

    try {
      const blocks = parseMarkdownMeasurementBlocks(`\`\`\`ts\n${'const value = 1;\n'.repeat(4000)}`);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.kind).toBe('code');
      expect(replaceSpy).not.toHaveBeenCalled();
      expect(splitSpy).not.toHaveBeenCalled();
    } finally {
      replaceSpy.mockRestore();
      splitSpy.mockRestore();
    }
  });

  it('measures video markdown as video blocks without dropping surrounding text', () => {
    const blocks = parseMarkdownMeasurementBlocks([
      'Intro text',
      '![video](https://example.com/movie.mp4)',
      '<img src="https://example.com/clip.webm">',
      'Trailing text',
    ].join('\n'));

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.kind).toBe('text');
    expect(blocks[1]).toEqual({
      kind: 'video',
      widthInset: 0,
    });
    expect(blocks[2]).toEqual({
      kind: 'video',
      widthInset: 0,
    });
  });

  it('does not measure stripped image markdown as text in video sections', () => {
    const blocks = parseMarkdownMeasurementBlocks([
      '![image](https://example.com/real.png)',
      '![video](https://example.com/movie.mp4)',
    ].join('\n'));

    expect(blocks).toEqual([
      {
        kind: 'video',
        widthInset: 0,
      },
    ]);
  });

  it('keeps relative directory image markdown as text in video sections', () => {
    const blocks = parseMarkdownMeasurementBlocks([
      '![local](images/demo.png)',
      '![video](https://example.com/movie.mp4)',
    ].join('\n'));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.kind).toBe('text');
    expect(blocks[1]).toEqual({
      kind: 'video',
      widthInset: 0,
    });
  });

  it('bounds video image token scans during layout parsing', () => {
    const markdown = Array.from({ length: 2001 }, (_, index) => {
      return `![video ${index}](https://example.com/${index}.mp4)`;
    }).join('\n');

    const blocks = parseMarkdownMeasurementBlocks(markdown);

    expect(blocks.filter((block) => block.kind === 'video')).toHaveLength(2000);
    expect(blocks.some((block) => block.kind === 'text')).toBe(true);
  });

  it('bounds layout parsing by scanned markdown characters', () => {
    const markdown = [
      'Intro',
      'x'.repeat(MAX_ASSISTANT_MARKDOWN_MEASUREMENT_SCAN_CHARS),
      '# Hidden tail',
    ].join('\n');

    const blocks = parseMarkdownMeasurementBlocks(markdown);

    expect(blocks.some((block) => block.kind === 'text')).toBe(true);
    expect(blocks).toHaveLength(1);
  });

  it('bounds layout parsing by generated measurement blocks', () => {
    const markdown = Array.from(
      { length: MAX_ASSISTANT_MARKDOWN_MEASUREMENT_BLOCKS + 1 },
      (_, index) => `# Heading ${index}`,
    ).join('\n');

    const blocks = parseMarkdownMeasurementBlocks(markdown);

    expect(blocks).toHaveLength(MAX_ASSISTANT_MARKDOWN_MEASUREMENT_BLOCKS);
  });

  it('does not cache oversized markdown block parses by full content', () => {
    const smallMarkdown = 'Small paragraph';
    expect(parseMarkdownMeasurementBlocks(smallMarkdown)).toBe(parseMarkdownMeasurementBlocks(smallMarkdown));

    const largeMarkdown = `${'Large paragraph '.repeat(4000)}\n\nTail`;
    expect(parseMarkdownMeasurementBlocks(largeMarkdown)).not.toBe(parseMarkdownMeasurementBlocks(largeMarkdown));
  });
});
