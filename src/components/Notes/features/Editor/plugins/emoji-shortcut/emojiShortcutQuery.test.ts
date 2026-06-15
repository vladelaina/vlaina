import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  it('marks the embedded picker menu as non-editor chrome for blank-area pointer handling', () => {
    const menuViewSource = readFileSync(
      resolve(process.cwd(), 'src/components/Notes/features/Editor/plugins/emoji-shortcut/EmojiShortcutMenuView.ts'),
      'utf8',
    );

    expect(menuViewSource).toContain("menu.setAttribute('data-no-editor-drag-box', 'true')");
  });

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
