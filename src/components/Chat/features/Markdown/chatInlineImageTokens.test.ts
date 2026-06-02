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

  it('does not compact escaped image markdown', () => {
    const src = createLargeDataImage('e');

    const markdown = String.raw`\![literal](<${src}>)`;
    const result = compactLargeDataImageMarkdown(markdown);

    expect(result.replaced).toBe(0);
    expect(result.markdown).toBe(markdown);
  });
});
