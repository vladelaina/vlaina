import data from '@emoji-mart/data';
import { COLOR_HEX, type ItemColor } from '@/lib/colors/index';

export type TabType = 'emoji' | 'upload';

export const RECENT_ICONS_KEY = 'vlaina-recent-icons';
export const SKIN_TONE_KEY = 'vlaina-emoji-skin-tone';
export const ICON_COLOR_KEY = 'vlaina-icon-color';
export const ACTIVE_TAB_KEY = 'vlaina-icon-picker-tab';
export const MAX_RECENT_EMOJIS = 18;
export const EMOJI_PER_ROW = 9;
export const EMOJI_SIZE = 32;
export const ROW_GAP = 2;

export const SCROLLBAR_CLASSNAME = `
  [&::-webkit-scrollbar]:w-1.5
  [&::-webkit-scrollbar-track]:bg-transparent
  [&::-webkit-scrollbar-thumb]:bg-[#efefef]
  [&::-webkit-scrollbar-thumb]:rounded-full
  [&::-webkit-scrollbar-thumb]:hover:bg-[var(--vlaina-text-tertiary)]
`;

export const SKIN_TONES = [
  { tone: 0, emoji: '\u{1F44B}', label: 'Default' },
  { tone: 1, emoji: '\u{1F44B}\u{1F3FB}', label: 'Light' },
  { tone: 2, emoji: '\u{1F44B}\u{1F3FC}', label: 'Medium-Light' },
  { tone: 3, emoji: '\u{1F44B}\u{1F3FD}', label: 'Medium' },
  { tone: 4, emoji: '\u{1F44B}\u{1F3FE}', label: 'Medium-Dark' },
  { tone: 5, emoji: '\u{1F44B}\u{1F3FF}', label: 'Dark' },
];

export const CATEGORY_NAMES: Record<string, string> = {
  frequent: 'Recent',
  people: 'Smileys & People',
  nature: 'Animals & Nature',
  foods: 'Food & Drink',
  activity: 'Activity',
  places: 'Travel & Places',
  objects: 'Objects',
  symbols: 'Symbols',
  flags: 'Flags',
};

export const CATEGORY_ICONS: Record<string, string> = {
  people: '\u{1F497}',
  nature: '\u{1F984}',
  foods: '\u{1F980}',
  activity: '\u{1F380}',
  places: '\u{1F308}',
  objects: '\u{1F9FC}',
  symbols: '\u{269C}\u{FE0F}',
  flags: '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}',
};

const ALLOWED_FLAGS = new Set([
  '🏁', '🎌', '🏴', '🏴‍☠️', '🏳️‍🌈', '🏳️‍⚧️', '🚩', '🏳️',
]);

export interface EmojiItem {
  id: string;
  native: string;
  name: string;
  keywords: string[];
  skins?: { native: string }[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  emojis: EmojiItem[];
}

function buildEmojiCategories(): EmojiCategory[] {
  const emojiData = data as any;
  const categories: EmojiCategory[] = [];

  for (const cat of emojiData.categories) {
    if (cat.id === 'frequent') continue;

    const emojis: EmojiItem[] = [];
    const seenNative = new Set<string>();

    for (const emojiId of cat.emojis) {
      const emoji = emojiData.emojis[emojiId];
      if (emoji && emoji.skins && emoji.skins[0]) {
        const native = emoji.skins[0].native;

        if (cat.id === 'flags' && !ALLOWED_FLAGS.has(native)) {
          continue;
        }

        if (seenNative.has(native)) {
          continue;
        }
        seenNative.add(native);

        emojis.push({
          id: emojiId,
          native,
          name: emoji.name || emojiId,
          keywords: emoji.keywords || [],
          skins: emoji.skins,
        });
      }
    }

    categories.push({
      id: cat.id,
      name: CATEGORY_NAMES[cat.id] || cat.id,
      emojis,
    });
  }

  return categories;
}

export const EMOJI_CATEGORIES = buildEmojiCategories();

export const EMOJI_MAP = new Map<string, EmojiItem>();
for (const cat of EMOJI_CATEGORIES) {
  for (const emoji of cat.emojis) {
    EMOJI_MAP.set(emoji.native, emoji);
    if (emoji.skins) {
      for (const skin of emoji.skins) {
        if (skin.native !== emoji.native) {
          EMOJI_MAP.set(skin.native, emoji);
        }
      }
    }
  }
}

export const ICON_MAP = new Map<string, any>(); // Empty placeholder map

export function loadRecentIcons(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_ICONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveRecentIcons(icons: string[]): void {
  try {
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(icons));
  } catch { }
}

export function addToRecentIcons(icon: string, current: string[]): string[] {
  const filtered = current.filter(i => i !== icon);
  const updated = [icon, ...filtered].slice(0, MAX_RECENT_EMOJIS);
  saveRecentIcons(updated);
  return updated;
}

export function loadSkinTone(): number {
  try {
    const saved = localStorage.getItem(SKIN_TONE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveSkinTone(tone: number): void {
  try {
    localStorage.setItem(SKIN_TONE_KEY, tone.toString());
  } catch { }
}

export function loadIconColor(): ItemColor {
  try {
    const saved = localStorage.getItem(ICON_COLOR_KEY);
    return (saved && saved in COLOR_HEX) ? (saved as ItemColor) : 'amber';
  } catch {
    return 'amber';
  }
}

export function saveIconColor(color: ItemColor): void {
  try {
    localStorage.setItem(ICON_COLOR_KEY, color);
  } catch { }
}

export function loadActiveTab(): TabType {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    return (saved === 'emoji' || saved === 'upload') ? saved : 'emoji';
  } catch {
    return 'emoji';
  }
}

export function saveActiveTab(tab: TabType): void {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch { }
}

export function getRandomEmoji(skinTone: number = 0): string {
  if (EMOJI_CATEGORIES.length === 0) return '📝';
  const availableCategories = EMOJI_CATEGORIES.slice(0, -3);
  const categories = availableCategories.length > 0 ? availableCategories : EMOJI_CATEGORIES;

  const category = categories[Math.floor(Math.random() * categories.length)];
  if (category.emojis.length === 0) return '📝';
  const emoji = category.emojis[Math.floor(Math.random() * category.emojis.length)];

  if (emoji.skins && emoji.skins.length > skinTone && skinTone > 0) {
    return emoji.skins[skinTone].native;
  }

  return emoji.native;
}
