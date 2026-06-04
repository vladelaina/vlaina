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
});
