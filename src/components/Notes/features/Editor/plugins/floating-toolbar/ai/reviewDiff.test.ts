import { describe, expect, it } from 'vitest';
import { __testing__ } from './reviewDiff';

describe('review diff', () => {
  it('marks inserted content as added segments', () => {
    const parts = __testing__.diffTokens('Hello world', 'Hello brave world');

    expect(parts).toEqual([
      { type: 'equal', text: 'Hello' },
      { type: 'added', text: ' brave' },
      { type: 'equal', text: ' world' },
    ]);
  });

  it('renders deleted and inserted markup for replaced text', () => {
    const markup = __testing__.renderAiReviewDiffMarkup('你好啊', 'Hello there');

    expect(markup).toContain('ai-review-diff-removed');
    expect(markup).toContain('ai-review-diff-added');
    expect(markup).toContain('你好啊');
    expect(markup).toContain('Hello there');
  });

  it('escapes diff text before rendering markup', () => {
    const markup = __testing__.renderAiReviewDiffMarkup('<script>old</script>', '<img src=x onerror=alert(1)>');

    expect(markup).toContain('&lt;script&gt;old&lt;/script&gt;');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).not.toContain('<script>');
    expect(markup).not.toContain('<img src=x');
  });

  it('falls back to whole-range replacement for very large diff matrices', () => {
    const previous = Array.from({ length: 600 }, (_, index) => `a${index}`).join(' ');
    const next = Array.from({ length: 600 }, (_, index) => `b${index}`).join(' ');
    const parts = __testing__.diffTokens(previous, next);

    expect(parts).toEqual([
      { type: 'removed', text: previous },
      { type: 'added', text: next },
    ]);
  });
});
