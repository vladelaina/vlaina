import { describe, expect, it } from 'vitest';
import {
  replaceRenderableMarkdownImageTokens,
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

  it('bounds renderable markdown image replacement work', () => {
    const content = Array.from({ length: 2001 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    }).join('\n');

    const replaced = replaceRenderableMarkdownImageTokens(content, '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2000);
    expect(replaced).toContain('![image 2000](https://example.com/2000.png)');
  });
});
