import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import {
  extractThinkingSections,
  getParsedAssistantMarkdown,
} from './chatAssistantMarkdownParsing';
import {
  MAX_EXTRACTED_THINKING_CONTENT_CHARS,
  MAX_THINKING_TAG_MATCHES,
} from '@/lib/ai/stripThinkingContent';

function message(id: string): ChatMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    modelId: 'model-1',
    timestamp: 1,
    versions: [],
    currentVersionIndex: 0,
  };
}

describe('chatAssistantMarkdownParsing', () => {
  it('extracts thinking sections without dropping visible markdown', () => {
    expect(extractThinkingSections('Intro<think>hidden</think>Answer')).toEqual({
      body: 'hidden',
      isComplete: true,
      markdown: 'IntroAnswer',
    });
  });

  it('keeps ordinary long assistant markdown intact when there is no thinking tag', () => {
    const markdown = `${'Visible paragraph. '.repeat(40_000)}Tail`;

    expect(extractThinkingSections(markdown)).toEqual({
      body: '',
      isComplete: true,
      markdown,
    });
  });

  it('bounds thinking extraction during assistant layout parsing', () => {
    const markdown = Array.from({ length: MAX_THINKING_TAG_MATCHES + 5 }, (_, index) =>
      `<think>hidden-${index}</think>Visible-${index}`
    ).join('');

    const sections = extractThinkingSections(markdown);

    expect(sections.body).toContain(`hidden-${MAX_THINKING_TAG_MATCHES - 1}`);
    expect(sections.body).not.toContain(`hidden-${MAX_THINKING_TAG_MATCHES}`);
    expect(sections.markdown).toContain(`Visible-${MAX_THINKING_TAG_MATCHES - 2}`);
    expect(sections.markdown).not.toContain(`Visible-${MAX_THINKING_TAG_MATCHES - 1}`);
  });

  it('caps extracted thinking body length without dropping following visible markdown', () => {
    const markdown = `<think>${'x'.repeat(MAX_EXTRACTED_THINKING_CONTENT_CHARS + 10)}</think>Answer`;
    const sections = extractThinkingSections(markdown);

    expect(sections.body).toHaveLength(MAX_EXTRACTED_THINKING_CONTENT_CHARS);
    expect(sections.markdown).toBe('Answer');
  });

  it('caches ordinary assistant markdown parses', () => {
    const markdown = 'Small paragraph';

    expect(getParsedAssistantMarkdown(message('small-1'), markdown)).toBe(
      getParsedAssistantMarkdown(message('small-2'), markdown),
    );
  });

  it('does not cache oversized assistant markdown by full content', () => {
    const markdown = `${'Large paragraph '.repeat(4000)}\n\nTail`;

    expect(getParsedAssistantMarkdown(message('large-1'), markdown)).not.toBe(
      getParsedAssistantMarkdown(message('large-2'), markdown),
    );
  });
});
