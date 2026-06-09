import { describe, expect, it } from 'vitest';
import {
  replaceRenderableMarkdownImageTokens,
  replaceRenderableMessageImageTokens,
  stripRenderableMarkdownImageTokens,
} from './renderableImageTokens';

describe('renderableImageTokens', () => {
  it('replaces real markdown images while preserving video image syntax', () => {
    const content = [
      '![image](https://example.com/real.png)',
      '![video](https://example.com/movie.mp4)',
      '![blocked](asset://localhost/not-allowed.png)',
    ].join('\n');

    expect(replaceRenderableMarkdownImageTokens(content, '[Image]')).toBe([
      '[Image]',
      '![video](https://example.com/movie.mp4)',
      '![blocked](asset://localhost/not-allowed.png)',
    ].join('\n'));
    expect(stripRenderableMarkdownImageTokens(content)).toBe([
      '',
      '![video](https://example.com/movie.mp4)',
      '![blocked](asset://localhost/not-allowed.png)',
    ].join('\n'));
  });

  it('keeps escaped angle brackets inside markdown image destinations', () => {
    expect(
      replaceRenderableMarkdownImageTokens(
        String.raw`![image](<https://example.com/path/image-\>.png>)`,
        '[Image]',
      ),
    ).toBe('[Image]');
  });

  it('replaces renderable markdown and raw html message image tokens', () => {
    const content = [
      '<img src="https://example.com/html.png">',
      '![image](https://example.com/real.png)',
      '<img src="https://example.com/movie.mp4">',
    ].join('\n');

    expect(replaceRenderableMessageImageTokens(content, '[Image]')).toBe([
      '[Image]',
      '[Image]',
      '<img src="https://example.com/movie.mp4">',
    ].join('\n'));
  });

  it('bounds renderable markdown image replacement work', () => {
    const content = Array.from({ length: 2001 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    }).join('\n');

    const replaced = replaceRenderableMarkdownImageTokens(content, '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2000);
    expect(replaced).toContain('![image 2000](https://example.com/2000.png)');
  });

  it('scrubs overflow markdown data images after the replacement budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const oversized = `![secret](<data:image/png;base64,${'A'.repeat(16 * 1024)}>)`;

    const replaced = replaceRenderableMarkdownImageTokens([...safeImages, oversized].join('\n'), '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2001);
    expect(replaced).not.toContain('data:image/png;base64');
  });

  it('scrubs overflow html data images in message replacement after the token budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const oversized = `<img src="data:image/png;base64,${'B'.repeat(16 * 1024)}" alt="secret">`;

    const replaced = replaceRenderableMessageImageTokens([...safeImages, oversized].join('\n'), '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2001);
    expect(replaced).not.toContain('data:image/png;base64');
  });
});
