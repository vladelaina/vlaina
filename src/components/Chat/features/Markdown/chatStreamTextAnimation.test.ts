import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChatStreamBlocks } from './chatStreamTextAnimation';

describe('useChatStreamBlocks', () => {
  it('does not count fenced code image syntax as stable gallery images', () => {
    const stable = [
      'Stable paragraph. '.repeat(14),
      '```md',
      '![example only](code.png)',
      '```',
      '',
      '',
    ].join('\n');
    const blocks = renderHook(() => useChatStreamBlocks(`${stable}![real](real.png)`, true)).result.current;

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      content: '![real](real.png)',
      imageIndexOffset: 0,
    });
  });

  it('counts stable markdown images outside fenced code for active image offsets', () => {
    const stable = [
      'Stable paragraph. '.repeat(14),
      '![stable](stable.png)',
      '```md',
      '![example only](code.png)',
      '```',
      '',
      '',
    ].join('\n');
    const blocks = renderHook(() => useChatStreamBlocks(`${stable}![real](real.png)`, true)).result.current;

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      content: '![real](real.png)',
      imageIndexOffset: 1,
    });
  });

  it('counts stable raw html images for active image offsets', () => {
    const stable = [
      'Stable paragraph. '.repeat(14),
      '<img src="https://example.com/stable.png">',
      '',
      '',
    ].join('\n');
    const blocks = renderHook(() => useChatStreamBlocks(`${stable}![real](real.png)`, true)).result.current;

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      content: '![real](real.png)',
      imageIndexOffset: 1,
    });
  });

  it('ignores stable image examples in inline code for active image offsets', () => {
    const stable = [
      'Stable paragraph. '.repeat(14),
      '`![inline](inline.png)`',
      '`<img src="https://example.com/inline.png">`',
      '',
      '',
    ].join('\n');
    const blocks = renderHook(() => useChatStreamBlocks(`${stable}![real](real.png)`, true)).result.current;

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      content: '![real](real.png)',
      imageIndexOffset: 0,
    });
  });

  it('does not count stable unrenderable images or videos for active image offsets', () => {
    const stable = [
      'Stable paragraph. '.repeat(14),
      '![svg](<data:image/svg+xml;base64,PHN2Zz4=>)',
      '![video](https://example.com/movie.mp4)',
      '![real](https://example.com/stable.png)',
      '',
      '',
    ].join('\n');
    const blocks = renderHook(() => useChatStreamBlocks(`${stable}![tail](tail.png)`, true)).result.current;

    expect(blocks).toHaveLength(2);
    expect(blocks[1]).toMatchObject({
      content: '![tail](tail.png)',
      imageIndexOffset: 1,
    });
  });
});
