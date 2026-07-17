import { describe, expect, it } from 'vitest';

import { hasCommittedCompositionText } from './compositionMarkdown';

describe('hasCommittedCompositionText', () => {
  it('does not mistake an earlier identical phrase for the current composition commit', () => {
    expect(hasCommittedCompositionText('你好\n\nnihao', '你好', '你好\n\n')).toBe(false);
  });

  it('accepts a new occurrence of the committed phrase', () => {
    expect(hasCommittedCompositionText('你好\n\n你好', '你好', '你好\n\n')).toBe(true);
  });

  it('accepts a shorter commit that replaces a selected phrase without increasing its count', () => {
    expect(hasCommittedCompositionText('你好', '你好', '你好呀', '你好呀', 'nihao')).toBe(true);
  });

  it('rejects stale residue after a selection was removed even when the phrase exists elsewhere', () => {
    expect(hasCommittedCompositionText('你好\n\nnihao', '你好', '你好\n\n旧文本', '旧文本', 'nihao')).toBe(false);
  });
});
