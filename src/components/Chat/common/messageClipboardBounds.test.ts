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

  it('scrubs overflow html data images when earlier attributes contain angle brackets', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      'B <img alt="before > after" src="data:image/png;base64,abc">',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
    ].join('\n'));
    expect(copied).not.toContain('data:image');
  });

  it('scrubs entity-encoded overflow inline data images from bounded copy text fallback', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      'B <img src="data&colon;image&sol;png&semi;base64&comma;abc">',
      'C ![third](data&colon;image&sol;png&semi;base64&comma;def)',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
      'C [image]',
    ].join('\n'));
    expect(copied).not.toContain('data&colon;image&sol;');
    expect(copied).not.toContain('&semi;base64&comma;');
  });

  it('scrubs escaped-scheme overflow inline data images from bounded copy text fallback', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      String.raw`B ![third](data\:image/png;base64,def)`,
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
    ].join('\n'));
    expect(copied).not.toContain(String.raw`data\:image`);
  });

  it('keeps overflow inline data image examples inside code spans', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      'B `![example](data:image/png;base64,def)`',
      'C ![third](data:image/png;base64,ghi)',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B `![example](data:image/png;base64,def)`',
      'C [image]',
    ].join('\n'));
  });

  it('keeps overflow html data image examples inside code spans and fences', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      'B `<img src="data:image/png;base64,def">`',
      '```html',
      '<img src="data:image/png;base64,ghi">',
      '```',
      'C <img src="data:image/png;base64,jkl">',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B `<img src="data:image/png;base64,def">`',
      '```html',
      '<img src="data:image/png;base64,ghi">',
      '```',
      'C [image]',
    ].join('\n'));
  });

  it('does not scrub overflow html images only because non-src attributes mention data images', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      '<img src="https://example.com/real.png" alt="data:image/png;base64,not-src">',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      '<img src="https://example.com/real.png" alt="data:image/png;base64,not-src">',
    ].join('\n'));
  });

  it('does not scrub overflow html images when lazy data-src has data images but src is safe', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      '<img data-src="data:image/png;base64,not-src" src="https://example.com/real.png">',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      '<img data-src="data:image/png;base64,not-src" src="https://example.com/real.png">',
    ].join('\n'));
  });

  it('scrubs oversized markdown data images when token parsing skips the target', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      `B ![huge](<data:image/png;base64,${'A'.repeat(520 * 1024)}>)`,
      'C tail',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
      'C tail',
    ].join('\n'));
    expect(copied).not.toContain('data:image');
  });

  it('scrubs oversized markdown data images when no image tokens are parsed', () => {
    const content = [
      `B ![huge](<data:image/png;base64,${'A'.repeat(1024 * 1024 + 16)}>)`,
      'C tail',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'B [image]',
      'C tail',
    ].join('\n'));
    expect(copied).not.toContain('data:image');
  });

  it('scrubs entity-encoded oversized markdown data images when no image tokens are parsed', () => {
    const content = [
      `B ![huge](<data&colon;image&sol;png&semi;base64&comma;${'A'.repeat(1024 * 1024 + 16)}>)`,
      'C tail',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'B [image]',
      'C tail',
    ].join('\n'));
    expect(copied).not.toContain('data&colon;image&sol;');
    expect(copied).not.toContain('&semi;base64&comma;');
  });

  it('scrubs overflow markdown data images with long labels', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      `B ![${'a'.repeat(2048)}](<data:image/png;base64,def>)`,
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
    ].join('\n'));
    expect(copied).not.toContain('data:image');
  });

  it('scrubs overflow html data images when the tag exceeds the copy scan budget', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      `B <img src="data:image/png;base64,${'A'.repeat(24_000)}" alt="overflow">`,
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
    ].join('\n'));
    expect(copied).not.toContain('data:image');
  });

  it('scrubs unterminated markdown data images when token parsing skips the target', () => {
    const content = [
      'A ![first](https://example.com/first.png)',
      `B ![huge](<data:image/png;base64,${'A'.repeat(32 * 1024)}`,
      'C tail',
    ].join('\n');

    const copied = formatMessageCopyText(content, { maxTokens: 1 });

    expect(copied).toBe([
      'A https://example.com/first.png',
      'B [image]',
      'C tail',
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
