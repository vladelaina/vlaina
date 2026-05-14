import { describe, expect, it } from 'vitest';
import { buildParsedAssistantMarkdown } from './chatAssistantMarkdownBlocks';

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
});
