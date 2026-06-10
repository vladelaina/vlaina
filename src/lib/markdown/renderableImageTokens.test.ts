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

  it('scrubs overflow entity-encoded markdown data images after the replacement budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const encoded = `![secret](<data&colon;image&sol;png&semi;base64&comma;${'A'.repeat(16 * 1024)}>)`;

    const replaced = replaceRenderableMarkdownImageTokens([...safeImages, encoded].join('\n'), '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2001);
    expect(replaced).not.toContain('data&colon;image&sol;');
    expect(replaced).not.toContain('&semi;base64&comma;');
  });

  it('keeps code markdown data images when scrubbing after the replacement budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const codeImage = `![example](<data:image/png;base64,${'B'.repeat(16 * 1024)}>)`;
    const oversized = `![secret](<data:image/png;base64,${'C'.repeat(16 * 1024)}>)`;

    const replaced = replaceRenderableMarkdownImageTokens([
      '```md',
      codeImage,
      '```',
      `\`${codeImage}\``,
      ...safeImages,
      oversized,
    ].join('\n'), '[Image]');

    expect(replaced).toContain(codeImage);
    expect(replaced).toContain(`\`${codeImage}\``);
    expect(replaced).not.toContain(oversized);
  });

  it('scrubs unterminated markdown data images after the replacement budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const unterminated = `![secret](<data:image/png;base64,${'D'.repeat(16 * 1024)}`;

    const replaced = replaceRenderableMarkdownImageTokens([...safeImages, unterminated, 'Tail'].join('\n'), '[Image]');

    expect(replaced).toContain('[Image]\nTail');
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

  it('scrubs overflow html data images after quoted attributes with angle brackets', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const oversized = `<img alt="before > after" src="data:image/png;base64,${'B'.repeat(16 * 1024)}">`;

    const replaced = replaceRenderableMessageImageTokens([...safeImages, oversized].join('\n'), '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2001);
    expect(replaced).not.toContain('data:image/png;base64');
  });

  it('keeps code html data images when scrubbing after the replacement budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const codeImage = `<img src="data:image/png;base64,${'C'.repeat(16 * 1024)}" alt="example">`;
    const oversized = `<img src="data:image/png;base64,${'D'.repeat(16 * 1024)}" alt="secret">`;

    const replaced = replaceRenderableMessageImageTokens([
      '```html',
      codeImage,
      '```',
      `\`${codeImage}\``,
      ...safeImages,
      oversized,
    ].join('\n'), '[Image]');

    expect(replaced).toContain(codeImage);
    expect(replaced).toContain(`\`${codeImage}\``);
    expect(replaced).not.toContain(oversized);
  });

  it('scrubs overflow entity-encoded html data images in message replacement after the token budget is reached', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const encoded = `<img src="data&colon;image&sol;png&semi;base64&comma;${'B'.repeat(16 * 1024)}" alt="secret">`;

    const replaced = replaceRenderableMessageImageTokens([...safeImages, encoded].join('\n'), '[Image]');

    expect(replaced.match(/\[Image\]/g)).toHaveLength(2001);
    expect(replaced).not.toContain('data&colon;image&sol;');
    expect(replaced).not.toContain('&semi;base64&comma;');
  });

  it('does not scrub overflow html images only because non-src attributes mention data images', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const image = '<img src="https://example.com/real.png" alt="data:image/png;base64,not-src">';

    const replaced = replaceRenderableMessageImageTokens([...safeImages, image].join('\n'), '[Image]');

    expect(replaced).toContain(image);
  });

  it('does not scrub overflow html images when lazy data-src has data images but src is safe', () => {
    const safeImages = Array.from({ length: 2000 }, (_, index) => {
      return `![image ${index}](https://example.com/${index}.png)`;
    });
    const image = '<img data-src="data:image/png;base64,not-src" src="https://example.com/real.png">';

    const replaced = replaceRenderableMessageImageTokens([...safeImages, image].join('\n'), '[Image]');

    expect(replaced).toContain(image);
  });
});
