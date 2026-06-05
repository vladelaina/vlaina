import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { getParsedAssistantMarkdown } from './chatAssistantMarkdownParsing';

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
