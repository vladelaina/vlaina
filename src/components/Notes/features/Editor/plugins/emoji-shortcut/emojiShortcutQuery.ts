import { EMOJI_CATEGORIES, type EmojiItem } from '@/components/common/UniversalIconPicker/constants';

export interface EmojiShortcutItem extends EmojiItem {
  searchText: string;
}

const MAX_EMOJI_SHORTCUT_RESULTS = 72;

export const emojiShortcutItems: EmojiShortcutItem[] = EMOJI_CATEGORIES.flatMap((category) =>
  category.emojis.map((emoji) => ({
    ...emoji,
    searchText: `${emoji.id} ${emoji.name} ${emoji.keywords.join(' ')}`.toLowerCase(),
  }))
);

function compactQuery(query: string): string {
  return query.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

export function filterEmojiShortcutItems(query: string, items = emojiShortcutItems): EmojiShortcutItem[] {
  const normalized = compactQuery(query);
  if (!normalized) return [];

  const exactPrefix: EmojiShortcutItem[] = [];
  const wordPrefix: EmojiShortcutItem[] = [];
  const contains: EmojiShortcutItem[] = [];

  for (const item of items) {
    if (item.id.toLowerCase().startsWith(normalized) || item.name.toLowerCase().startsWith(normalized)) {
      exactPrefix.push(item);
    } else if (item.searchText.split(/\s+/).some((part) => part.startsWith(normalized))) {
      wordPrefix.push(item);
    } else if (item.searchText.includes(normalized)) {
      contains.push(item);
    }
  }

  return [...exactPrefix, ...wordPrefix, ...contains].slice(0, MAX_EMOJI_SHORTCUT_RESULTS);
}
