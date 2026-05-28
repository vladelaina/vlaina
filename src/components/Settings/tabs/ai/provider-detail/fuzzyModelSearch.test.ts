import { describe, expect, it } from 'vitest';
import { getFuzzySearchScore, rankByFuzzySearch } from './fuzzyModelSearch';

describe('getFuzzySearchScore', () => {
  it('matches compact model queries across separators', () => {
    expect(getFuzzySearchScore('gpt-4o-mini', 'gpt4o')).not.toBeNull();
    expect(getFuzzySearchScore('claude-3.5-sonnet', 'claude35')).not.toBeNull();
  });

  it('matches ordered fuzzy characters', () => {
    expect(getFuzzySearchScore('deepseek-chat', 'dskc')).not.toBeNull();
    expect(getFuzzySearchScore('gpt-4o-mini', 'zz')).toBeNull();
  });
});

describe('rankByFuzzySearch', () => {
  it('returns fuzzy matches sorted by match quality', () => {
    expect(
      rankByFuzzySearch(['claude-3-5-sonnet', 'gpt-4o-mini', 'gpt-4.1'], 'gpt4', (modelId) => modelId)
    ).toEqual(['gpt-4.1', 'gpt-4o-mini']);
  });
});
