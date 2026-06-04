import { describe, expect, it } from 'vitest';
import { parseMarkdownMeasurementBlocks } from './chatAssistantMarkdownBlockParser';

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
});
