import { describe, expect, it } from 'vitest';
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
});
