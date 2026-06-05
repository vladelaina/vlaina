import { describe, expect, it } from 'vitest';
import {
  MAX_EXTRACTED_THINKING_CONTENT_CHARS,
  MAX_THINKING_TAG_MATCHES,
  parseThinkingContent,
  stripThinkingContent,
} from './stripThinkingContent';

describe('stripThinkingContent', () => {
  it('keeps ordinary long content intact when it has no thinking tags', () => {
    const content = `${'visible '.repeat(80_000)}tail`;

    expect(stripThinkingContent(content)).toBe(content);
    expect(parseThinkingContent(content)).toMatchObject({
      hasThinking: false,
      isComplete: true,
      parts: [],
      visible: content,
    });
  });

  it('extracts thinking parts and preserves visible content', () => {
    const parsed = parseThinkingContent('Intro<think>hidden one</think>Middle<think>hidden two</think>End');

    expect(parsed).toEqual({
      hasThinking: true,
      isComplete: true,
      parts: ['hidden one', 'hidden two'],
      visible: 'IntroMiddleEnd',
    });
    expect(stripThinkingContent('Intro<think>hidden</think>End')).toBe('IntroEnd');
  });

  it('caps extracted thinking content without dropping following visible content', () => {
    const content = `<think>${'x'.repeat(MAX_EXTRACTED_THINKING_CONTENT_CHARS + 100)}</think>Visible`;
    const parsed = parseThinkingContent(content);

    expect(parsed.parts.join('')).toHaveLength(MAX_EXTRACTED_THINKING_CONTENT_CHARS);
    expect(parsed.visible).toBe('Visible');
  });

  it('stops scanning after too many thinking tags', () => {
    const content = Array.from({ length: MAX_THINKING_TAG_MATCHES + 20 }, (_, index) =>
      `<think>hidden-${index}</think>Visible-${index}`
    ).join('');
    const parsed = parseThinkingContent(content);

    expect(parsed.parts).toHaveLength(MAX_THINKING_TAG_MATCHES);
    expect(parsed.visible).toContain(`Visible-${MAX_THINKING_TAG_MATCHES - 2}`);
    expect(parsed.visible).not.toContain(`Visible-${MAX_THINKING_TAG_MATCHES - 1}`);
  });

  it('treats unfinished thinking as incomplete and strips trailing close-tag prefixes', () => {
    const parsed = parseThinkingContent('Visible<think>hidden</thin');

    expect(parsed).toEqual({
      hasThinking: true,
      isComplete: false,
      parts: ['hidden'],
      visible: 'Visible',
    });
  });
});
