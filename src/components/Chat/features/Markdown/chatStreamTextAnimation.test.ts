import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  buildChatStreamSchedule,
  MAX_CHAT_STREAM_ANIMATION_CHARS,
  useChatStreamBlocks,
} from './chatStreamTextAnimation';

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

  it('keeps CRLF stable split offsets aligned with active stream markdown', () => {
    const stable = [
      'Stable paragraph. '.repeat(14),
      '```ts',
      'const value = 1;',
      '```',
      '',
      '',
    ].join('\r\n');
    const active = '```js\r\nconsole.log(1);\r\n```';

    const blocks = renderHook(() => useChatStreamBlocks(`${stable}${active}`, true)).result.current;

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      content: stable,
      key: expect.stringMatching(/^stable:/),
    });
    expect(blocks[1]).toMatchObject({
      codeBlockIndexOffset: 1,
      content: active,
    });
  });

  it('reveals oversized streaming content without per-character animation state', () => {
    const content = 'x'.repeat(MAX_CHAT_STREAM_ANIMATION_CHARS + 1);

    const scheduled = buildChatStreamSchedule(content, 260, 1000);
    const blocks = renderHook(() => useChatStreamBlocks(content, true)).result.current;

    expect(scheduled).toMatchObject({
      births: [],
      content,
      key: 'stream',
      revealed: true,
    });
    expect(blocks).toEqual([
      expect.objectContaining({
        births: [],
        content,
        key: 'static',
        revealed: true,
      }),
    ]);
  });
});
