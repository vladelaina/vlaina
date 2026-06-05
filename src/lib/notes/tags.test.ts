import { describe, expect, it } from 'vitest';

import { extractNoteTagOccurrences, extractNoteTags } from './tags';

describe('note tags', () => {
  it('does not truncate oversized tag tokens into sidebar tags', () => {
    expect(extractNoteTags(`#${'a'.repeat(129)} #valid`)).toEqual(['valid']);
  });

  it('caps extracted tag occurrences from a single document', () => {
    const content = Array.from({ length: 2500 }, (_, index) => `#tag-${index}`).join(' ');

    expect(extractNoteTagOccurrences(content)).toHaveLength(2000);
  });

  it('caps excluded ranges while still extracting visible tags', () => {
    const hiddenInlineCode = Array.from(
      { length: 12_000 },
      (_, index) => `\`#hidden-${index}\``
    ).join(' ');

    expect(extractNoteTags(`${hiddenInlineCode} #visible`)).toContain('visible');
  });
});
