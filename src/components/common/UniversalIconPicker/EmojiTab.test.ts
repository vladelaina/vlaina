import { describe, expect, it } from 'vitest';
import { filterEmojiPickerSearchResults } from './EmojiTab';
import type { EmojiCategory } from './constants';

const categories: EmojiCategory[] = [
  {
    id: 'people',
    name: 'Smileys & People',
    emojis: [
      {
        id: 'smile',
        native: '🙂',
        name: 'Smile',
        keywords: ['happy'],
      },
      {
        id: 'rocket',
        native: '🚀',
        name: 'Rocket',
        keywords: ['launch'],
      },
    ],
  },
];

describe('filterEmojiPickerSearchResults', () => {
  it('trims accidental whitespace before filtering emoji results', () => {
    expect(filterEmojiPickerSearchResults('  smile  ', categories).map((emoji) => emoji.id)).toEqual(['smile']);
  });

  it('returns no results for an empty trimmed query', () => {
    expect(filterEmojiPickerSearchResults('   ', categories)).toEqual([]);
  });
});
