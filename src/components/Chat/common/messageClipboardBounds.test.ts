import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  copyMessageContentToClipboard,
  extractMessageImageSources,
  formatMessageCopyText,
  stripMessageImageTokens,
} from './messageClipboard';

describe('messageClipboard bounded image parsing', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies optional image token bounds without changing default extraction', () => {
    const content = [
      '![first](https://example.com/first.png)',
      '<img src="https://example.com/second.png">',
      '![third](https://example.com/third.png)',
    ].join('\n');

    expect(extractMessageImageSources(content, { maxTokens: 2 })).toEqual([
      'https://example.com/first.png',
      'https://example.com/second.png',
    ]);
    expect(extractMessageImageSources(content)).toEqual([
      'https://example.com/first.png',
      'https://example.com/second.png',
      'https://example.com/third.png',
    ]);
  });

  it('bounds copy text image replacement when requested', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      'B <img src="data:image/png;base64,abc">',
      'C ![third](https://example.com/third.png)',
    ].join('\n');

    expect(formatMessageCopyText(content, { maxTokens: 2 })).toBe([
      'A https://example.com/first.png',
      'B [image]',
      'C ![third](https://example.com/third.png)',
    ].join('\n'));
    expect(stripMessageImageTokens(content, { maxTokens: 2 })).toBe([
      'A ',
      'B ',
      'C ![third](https://example.com/third.png)',
    ].join('\n'));
  });

  it('scrubs overflow inline data images from bounded copy text fallback', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      'B <img src="data:image/png;base64,abc">',
      'C ![third](data:image/png;base64,def)',
      'D <img alt="overflow" src=\'data:image/png;base64,ghi\'>',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 2 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
      'C [image]',
      'D [image]',
    ].join('\n'));
    expect(copied).not.toContain('data:image');
  });

  it('does not scan unbounded images before copying message text fallback', async () => {
    const videos = Array.from({ length: 2000 }, (_, index) => `![video-${index}](https://example.com/${index}.mp4)`);
    const content = [
      ...videos,
      '![real](https://example.com/real.png)',
      'tail',
    ].join('\n');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await copyMessageContentToClipboard(content);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
  });
});
