/** IconPicker Constants and Utilities */

import data from '@emoji-mart/data';
import { ICON_LIST } from './icons';
import type { IconItem } from './icons';

export type TabType = 'emoji' | 'icons' | 'upload';

export const RECENT_ICONS_KEY = 'nekotick-recent-icons';
export const SKIN_TONE_KEY = 'nekotick-emoji-skin-tone';
export const ICON_COLOR_KEY = 'nekotick-icon-color';
export const ACTIVE_TAB_KEY = 'nekotick-icon-picker-tab';
export const MAX_RECENT_EMOJIS = 18;
export const EMOJI_PER_ROW = 9;
export const EMOJI_SIZE = 32;
export const ROW_GAP = 2;
export const ICON_PER_ROW = 8;
export const ICON_SIZE = 32;

// Inline scrollbar styles for webkit (no arrow buttons)
export const SCROLLBAR_CLASSNAME = `
  [&::-webkit-scrollbar]:w-1.5
  [&::-webkit-scrollbar-track]:bg-transparent
  [&::-webkit-scrollbar-thumb]:bg-[var(--neko-border)]
  [&::-webkit-scrollbar-thumb]:rounded-full
  [&::-webkit-scrollbar-thumb]:hover:bg-[var(--neko-text-tertiary)]
`;

export const SKIN_TONES = [
  { tone: 0, emoji: '\u{1F44B}', label: 'Default' },
  { tone: 1, emoji: '\u{1F44B}\u{1F3FB}', label: 'Light' },
  { tone: 2, emoji: '\u{1F44B}\u{1F3FC}', label: 'Medium-Light' },
  { tone: 3, emoji: '\u{1F44B}\u{1F3FD}', label: 'Medium' },
  { tone: 4, emoji: '\u{1F44B}\u{1F3FE}', label: 'Medium-Dark' },
  { tone: 5, emoji: '\u{1F44B}\u{1F3FF}', label: 'Dark' },
];

export const ICON_COLORS = [
  { id: 0, color: '#f59e0b', label: 'Amber' },
  { id: 1, color: '#ef4444', label: 'Red' },
  { id: 2, color: '#f97316', label: 'Orange' },
  { id: 3, color: '#22c55e', label: 'Green' },
  { id: 4, color: '#3b82f6', label: 'Blue' },
  { id: 5, color: '#8b5cf6', label: 'Purple' },
  { id: 6, color: '#ec4899', label: 'Pink' },
  { id: 7, color: '#71717a', label: 'Gray' },
  { id: 8, color: '#18181b', label: 'Black' },
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

export const ICON_MAP = new Map<string, IconItem>();
for (const icon of ICON_LIST) {
  ICON_MAP.set(icon.name, icon);
}

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
  // For icons, deduplicate by name (ignore color)
  const getIconName = (i: string) => {
    if (i.startsWith('icon:')) {
      return i.split(':')[1];
    }
    return i;
  };

  const iconName = getIconName(icon);
  const filtered = current.filter(i => {
    if (icon.startsWith('icon:') && i.startsWith('icon:')) {
      // When both are icons, deduplicate by name
      return getIconName(i) !== iconName;
    }
    // For emoji or different types, compare fully
    return i !== icon;
  });

  if (icon.startsWith('icon:')) {
    const icons = filtered.filter(i => i.startsWith('icon:'));
    const emojis = filtered.filter(i => !i.startsWith('icon:'));
    const updated = [icon, ...icons.slice(0, MAX_RECENT_EMOJIS - 1), ...emojis];
    saveRecentIcons(updated);
    return updated;
  } else {
    const icons = filtered.filter(i => i.startsWith('icon:'));
    const emojis = filtered.filter(i => !i.startsWith('icon:'));
    const updated = [icon, ...emojis.slice(0, MAX_RECENT_EMOJIS - 1), ...icons];
    saveRecentIcons(updated);
    return updated;
  }
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

export function loadIconColor(): number {
  try {
    const saved = localStorage.getItem(ICON_COLOR_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

export function saveIconColor(colorId: number): void {
  try {
    localStorage.setItem(ICON_COLOR_KEY, colorId.toString());
  } catch { }
}

export function loadActiveTab(): TabType {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    return (saved === 'emoji' || saved === 'icons' || saved === 'upload') ? saved : 'emoji';
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
  // Exclude last 3 categories (Objects, Symbols, Flags) as requested
  const availableCategories = EMOJI_CATEGORIES.slice(0, -3);
  const categories = availableCategories.length > 0 ? availableCategories : EMOJI_CATEGORIES;

  const category = categories[Math.floor(Math.random() * categories.length)];
  if (category.emojis.length === 0) return '📝';
  const emoji = category.emojis[Math.floor(Math.random() * category.emojis.length)];

  // Respect skin tone if available
  if (emoji.skins && emoji.skins.length > skinTone && skinTone > 0) {
    return emoji.skins[skinTone].native;
  }

  return emoji.native;
}
