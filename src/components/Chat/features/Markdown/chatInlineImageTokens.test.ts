import { describe, expect, it } from 'vitest';
import {
  compactLargeDataImageMarkdown,
  resolveCompactedChatImageSrc,
} from './chatInlineImageTokens';

function createLargeDataImage(payload = 'a') {
  return `data:image/png;base64,${payload.repeat(60_000)}`;
}

describe('chatInlineImageTokens', () => {
  it('compacts only renderable large data image markdown', () => {
    const codeImage = createLargeDataImage('b');
    const realImage = createLargeDataImage('c');
    const markdown = [
      '```md',
      `![example](<${codeImage}>)`,
      '```',
      `\`![inline](<${codeImage}>)\``,
      `![real](<${realImage}>)`,
    ].join('\n');

    const result = compactLargeDataImageMarkdown(markdown);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toContain(`![example](<${codeImage}>)`);
    expect(result.markdown).toContain(`\`![inline](<${codeImage}>)\``);
    expect(result.markdown).toContain('![real](<asset://localhost/chat-inline-image/0>)');
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken)).toBe(realImage);
  });

  it('replaces only the image target when the same data URL appears in alt text', () => {
    const src = createLargeDataImage('d');

    const result = compactLargeDataImageMarkdown(`![${src}](<${src}>)`);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toBe(`![${src}](<asset://localhost/chat-inline-image/0>)`);
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken)).toBe(src);
  });

  it('compacts large data image markdown with entity-encoded targets', () => {
    const src = createLargeDataImage('f');
    const encodedSrc = src.replace('data:image/', 'data&colon;image&sol;');

    const result = compactLargeDataImageMarkdown(`![real](<${encodedSrc}>)`);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toBe('![real](<asset://localhost/chat-inline-image/0>)');
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken)).toBe(src);
  });

  it('compacts large data image markdown with case-insensitive data image schemes', () => {
    const src = createLargeDataImage('g').replace('data:image/png;base64,', 'DATA:IMAGE/PNG;BASE64,');

    const result = compactLargeDataImageMarkdown(`![real](<${src}>)`);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toBe('![real](<asset://localhost/chat-inline-image/0>)');
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken)).toBe(
      createLargeDataImage('g'),
    );
  });

  it('compacts large data image html tags by replacing only the src value', () => {
    const src = createLargeDataImage('h');

    const result = compactLargeDataImageMarkdown(`<img alt="inline" src="${src}" data-id="keep">`);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toBe('<img alt="inline" src="asset://localhost/chat-inline-image/0" data-id="keep">');
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken)).toBe(src);
  });

  it('compacts large data image html tags with entity-encoded src values', () => {
    const src = createLargeDataImage('i');
    const encodedSrc = src.replace('data:image/', 'data&colon;image&sol;');

    const result = compactLargeDataImageMarkdown(`<img src="${encodedSrc}" alt="inline">`);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toBe('<img src="asset://localhost/chat-inline-image/0" alt="inline">');
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken)).toBe(src);
  });

  it('does not reuse existing inline image tokens from the original markdown', () => {
    const src = createLargeDataImage('j');
    const markdown = [
      '![existing](<asset://localhost/chat-inline-image/0>)',
      `![large](<${src}>)`,
    ].join('\n');

    const result = compactLargeDataImageMarkdown(markdown);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toBe([
      '![existing](<asset://localhost/chat-inline-image/0>)',
      '![large](<asset://localhost/chat-inline-image/1>)',
    ].join('\n'));
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/0', result.imageSrcByToken))
      .toBe('asset://localhost/chat-inline-image/0');
    expect(resolveCompactedChatImageSrc('asset://localhost/chat-inline-image/1', result.imageSrcByToken)).toBe(src);
  });

  it('bounds existing inline image token collection before compacting new images', () => {
    const src = createLargeDataImage('l');
    const existing = Array.from(
      { length: 2500 },
      (_, index) => `asset://localhost/chat-inline-image/${index}`
    ).join(' ');
    const result = compactLargeDataImageMarkdown(`${existing}\n![large](<${src}>)`);

    expect(result.replaced).toBe(1);
    expect(result.markdown).toContain('![large](<asset://localhost/chat-inline-image/2000>)');
  });

  it('does not compact escaped image markdown', () => {
    const src = createLargeDataImage('e');

    const markdown = String.raw`\![literal](<${src}>)`;
    const result = compactLargeDataImageMarkdown(markdown);

    expect(result.replaced).toBe(0);
    expect(result.markdown).toBe(markdown);
  });

  it('caps the number of compacted inline data images', () => {
    const src = createLargeDataImage('k');
    const markdown = Array.from({ length: 1005 }, (_, index) => `![image ${index}](<${src}>)`).join('\n');

    const result = compactLargeDataImageMarkdown(markdown);

    expect(result.replaced).toBe(1000);
    expect(result.imageSrcByToken).toHaveLength(1000);
    expect(result.markdown).toContain('![image 999](<asset://localhost/chat-inline-image/999>)');
    expect(result.markdown).toContain(`![image 1000](<${src}>)`);
  });
});
