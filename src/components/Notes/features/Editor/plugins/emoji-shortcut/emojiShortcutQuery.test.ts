import { describe, expect, it } from 'vitest';
import { filterEmojiShortcutItems, type EmojiShortcutItem } from './emojiShortcutQuery';

function emoji(id: string, name: string, keywords: string[] = []): EmojiShortcutItem {
  return {
    id,
    name,
    keywords,
    native: id,
    searchText: `${id} ${name} ${keywords.join(' ')}`.toLowerCase(),
  };
}

describe('filterEmojiShortcutItems', () => {
  it('returns no results for an empty query so plain colon does not open the picker', () => {
    expect(filterEmojiShortcutItems('', [emoji('smile', 'Smile')])).toEqual([]);
  });

  it('prioritizes id and name prefixes before keyword and contains matches', () => {
    const items = [
      emoji('party_popper', 'Party Popper', ['celebration']),
      emoji('grinning', 'Grinning Face', ['smile']),
      emoji('small_blue_diamond', 'Small Blue Diamond'),
    ];

    expect(filterEmojiShortcutItems('sm', items).map((item) => item.id)).toEqual([
      'small_blue_diamond',
      'grinning',
    ]);
  });

});
