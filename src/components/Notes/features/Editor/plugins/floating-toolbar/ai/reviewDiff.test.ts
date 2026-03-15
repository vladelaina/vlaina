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
});
