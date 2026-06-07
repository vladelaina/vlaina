import { describe, expect, it } from 'vitest';
import { MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES } from '@/components/Chat/common/messageClipboard';
import { buildParsedAssistantMarkdown, stripRenderableImageTokens } from './chatAssistantMarkdownBlocks';

describe('buildParsedAssistantMarkdown', () => {
  it('does not split stable markdown inside code blocks with shorter fence content', () => {
    const markdown = [
      'Intro',
      '',
      '````ts',
      '```',
      '',
      'const value = 1;',
      '````',
      '',
      'Tail',
    ].join('\n');

    const parsed = buildParsedAssistantMarkdown(markdown, markdown);

    expect(parsed.stableBlocks).toHaveLength(2);
    expect(parsed.stableBlocks[1]).toMatchObject({
      kind: 'code',
      code: ['```', '', 'const value = 1;'].join('\n'),
    });
    expect(parsed.tailRenderableMarkdown).toBe('Tail');
  });

  it('keeps the tail split aligned with original CRLF markdown offsets', () => {
    const markdown = [
      'Intro',
      '',
      '```ts',
      'const value = 1;',
      '```',
      '',
      'Tail',
    ].join('\r\n');

    const parsed = buildParsedAssistantMarkdown(markdown, markdown);

    expect(parsed.tailRenderableMarkdown).toBe('Tail');
    expect(parsed.stableBlocks).toHaveLength(2);
    expect(parsed.stableBlocks[1]).toMatchObject({
      kind: 'code',
      code: 'const value = 1;',
    });
  });

  it('does not count or strip image examples inside code spans and fenced code', () => {
    const markdown = [
      '`![inline](https://example.com/inline.png)`',
      '```html',
      '<img src="https://example.com/code-html.png">',
      '![code](https://example.com/code.png)',
      '```',
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
    ].join('\n');

    const parsed = buildParsedAssistantMarkdown(markdown, stripRenderableImageTokens(markdown));

    expect(parsed.imageCount).toBe(2);
    expect(parsed.renderableMarkdown).toContain('![inline](https://example.com/inline.png)');
    expect(parsed.renderableMarkdown).toContain('<img src="https://example.com/code-html.png">');
    expect(parsed.renderableMarkdown).not.toContain('![real](https://example.com/real.png)');
    expect(parsed.renderableMarkdown).not.toContain('<img src="https://example.com/real-html.png">');
  });

  it('does not count video markdown images as rendered images', () => {
    const markdown = [
      '![video](https://example.com/movie.mp4)',
      '<img src="https://example.com/clip.webm">',
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
    ].join('\n');

    const parsed = buildParsedAssistantMarkdown(markdown, stripRenderableImageTokens(markdown));

    expect(parsed.imageCount).toBe(2);
    expect(parsed.renderableMarkdown).toContain('![video](https://example.com/movie.mp4)');
    expect(parsed.renderableMarkdown).toContain('<img src="https://example.com/clip.webm">');
    expect(parsed.renderableMarkdown).not.toContain('![real](https://example.com/real.png)');
    expect(parsed.renderableMarkdown).not.toContain('<img src="https://example.com/real-html.png">');
  });

  it('bounds assistant image counting and stripping for pathological image-heavy markdown', () => {
    const markdown = Array.from(
      { length: MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES + 1 },
      (_, index) => `![image ${index}](https://example.com/${index}.png)`,
    ).join('\n');

    const renderableMarkdown = stripRenderableImageTokens(markdown);
    const parsed = buildParsedAssistantMarkdown(markdown, renderableMarkdown);

    expect(parsed.imageCount).toBe(MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES);
    expect(renderableMarkdown).toContain(
      `![image ${MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES}](https://example.com/${MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES}.png)`,
    );
  });
});
