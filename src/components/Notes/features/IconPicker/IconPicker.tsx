/**
 * IconPicker - Emoji and Icon picker with virtual scrolling
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import data from '@emoji-mart/data';
import { cn } from '@/lib/utils';
import { IconSearch, IconX } from '@tabler/icons-react';
import { ICON_CATEGORIES, ICON_LIST } from './icons';
import type { IconItem } from './icons';

export { ICON_LIST };

// 构建用于快速查找的 icon Map
const ICON_MAP = new Map<string, IconItem>();
for (const icon of ICON_LIST) {
  ICON_MAP.set(icon.name, icon);
}

type TabType = 'emoji' | 'icons';

const RECENT_ICONS_KEY = 'nekotick-recent-icons';
const SKIN_TONE_KEY = 'nekotick-emoji-skin-tone';
const ACTIVE_TAB_KEY = 'nekotick-icon-picker-tab';
const MAX_RECENT_EMOJIS = 18;
const EMOJI_PER_ROW = 9;
const EMOJI_SIZE = 32;
const ROW_GAP = 2;
const ICON_PER_ROW = 8;
const ICON_SIZE = 36;

const SKIN_TONES = [
  { tone: 0, emoji: '\u{1F44B}', label: 'Default' },
  { tone: 1, emoji: '\u{1F44B}\u{1F3FB}', label: 'Light' },
  { tone: 2, emoji: '\u{1F44B}\u{1F3FC}', label: 'Medium-Light' },
  { tone: 3, emoji: '\u{1F44B}\u{1F3FD}', label: 'Medium' },
  { tone: 4, emoji: '\u{1F44B}\u{1F3FE}', label: 'Medium-Dark' },
  { tone: 5, emoji: '\u{1F44B}\u{1F3FF}', label: 'Dark' },
];

function loadRecentIcons(): string[] {
  try {
    const saved = localStorage.getItem(RECENT_ICONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRecentIcons(icons: string[]): void {
  try {
    localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(icons));
  } catch { /* ignore */ }
}

function addToRecentIcons(icon: string, current: string[]): string[] {
  const filtered = current.filter(i => i !== icon);
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

function loadSkinTone(): number {
  try {
    const saved = localStorage.getItem(SKIN_TONE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  } catch {
    return 0;
  }
}

function saveSkinTone(tone: number): void {
  try {
    localStorage.setItem(SKIN_TONE_KEY, tone.toString());
  } catch { /* ignore */ }
}

function loadActiveTab(): TabType {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    return (saved === 'emoji' || saved === 'icons') ? saved : 'emoji';
  } catch {
    return 'emoji';
  }
}

function saveActiveTab(tab: TabType): void {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch { /* ignore */ }
}

interface EmojiItem {
  id: string;
  native: string;
  name: string;
  keywords: string[];
  skins?: { native: string }[];
}

interface EmojiCategory {
  id: string;
  name: string;
  emojis: EmojiItem[];
}

const CATEGORY_NAMES: Record<string, string> = {
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

const CATEGORY_ICONS: Record<string, string> = {
  people: '\u{1F497}',
  nature: '\u{1F984}',
  foods: '\u{1F980}',
  activity: '\u{1F380}',
  places: '\u{1F308}',
  objects: '\u{1F9FC}',
  symbols: '\u{269C}\u{FE0F}',
  flags: '\u{1F3F3}\u{FE0F}\u{200D}\u{1F308}',
};

// 允许的旗帜 emoji
const ALLOWED_FLAGS = new Set([
  '🏁', '🎌', '🏴', '🏴‍☠️', '🏳️‍🌈', '🏳️‍⚧️', '🚩', '🏳️',
]);


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
        
        // flags 分类只保留白名单中的旗帜
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

const EMOJI_CATEGORIES = buildEmojiCategories();

// 构建用于快速查找的 emoji Map
const EMOJI_MAP = new Map<string, EmojiItem>();
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

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string;
  onIconChange?: (emoji: string) => void;
}

// 虚拟滚动的 Emoji 网格
function VirtualEmojiGrid({
  emojis,
  skinTone,
  onSelect,
  onPreview,
  recentEmojis,
  categoryName,
}: {
  emojis: EmojiItem[];
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  recentEmojis: string[];
  categoryName: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // 计算带皮肤色调的 emoji
  const emojisWithSkin = useMemo(() => {
    return emojis.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [emojis, skinTone]);

  // 最近使用的 emoji 带皮肤色调
  const recentWithSkin = useMemo(() => {
    return recentEmojis.map(emoji => {
      const item = EMOJI_MAP.get(emoji);
      if (!item) return emoji;
      if (skinTone === 0 || !item.skins || item.skins.length <= skinTone) {
        return item.native;
      }
      return item.skins[skinTone]?.native || item.native;
    });
  }, [recentEmojis, skinTone]);

  // 计算行数据
  const rows = useMemo(() => {
    const result: { type: 'title' | 'emojis'; content: string | string[] }[] = [];
    
    // Recent section
    if (recentWithSkin.length > 0) {
      result.push({ type: 'title', content: 'Recent' });
      for (let i = 0; i < recentWithSkin.length; i += EMOJI_PER_ROW) {
        result.push({ type: 'emojis', content: recentWithSkin.slice(i, i + EMOJI_PER_ROW) });
      }
    }
    
    // Category section
    result.push({ type: 'title', content: categoryName });
    for (let i = 0; i < emojisWithSkin.length; i += EMOJI_PER_ROW) {
      result.push({ type: 'emojis', content: emojisWithSkin.slice(i, i + EMOJI_PER_ROW) });
    }
    
    return result;
  }, [emojisWithSkin, recentWithSkin, categoryName]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'title' ? 28 : EMOJI_SIZE + ROW_GAP,
    overscan: 5,
  });

  // 事件委托处理点击和悬停
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    if (button) {
      const emoji = button.dataset.emoji;
      if (emoji) onSelect(emoji);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    if (button) {
      const emoji = button.dataset.emoji;
      onPreview?.(emoji || null);
    }
  }, [onPreview]);

  const handleMouseLeave = useCallback(() => {
    onPreview?.(null);
  }, [onPreview]);

  return (
    <div
      ref={parentRef}
      className="h-[280px] overflow-auto neko-scrollbar"
      style={{ contain: 'strict' }}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-3 pt-2 pb-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {row.content as string}
                </div>
              ) : (
                <div className="px-3 flex gap-0.5">
                  {(row.content as string[]).map((emoji, i) => (
                    <button
                      key={i}
                      data-emoji={emoji}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VirtualIconGrid({
  icons,
  onSelect,
  onPreview,
  recentIcons,
  categoryName,
}: {
  icons: IconItem[];
  onSelect: (iconName: string, color: string) => void;
  onPreview?: (icon: string | null) => void;
  recentIcons: string[];
  categoryName: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const recentIconItems = useMemo(() => {
    return recentIcons
      .map(iconValue => {
        const parts = iconValue.split(':');
        const iconName = parts[1];
        const color = parts[2] || '#f59e0b';
        const iconItem = ICON_MAP.get(iconName);
        if (!iconItem) return null;
        return { ...iconItem, color };
      })
      .filter((item): item is IconItem => item !== null)
      .slice(0, 16);
  }, [recentIcons]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'icons'; content: string | IconItem[] }[] = [];
    
    if (recentIconItems.length > 0) {
      result.push({ type: 'title', content: 'Recent' });
      for (let i = 0; i < recentIconItems.length; i += ICON_PER_ROW) {
        result.push({ type: 'icons', content: recentIconItems.slice(i, i + ICON_PER_ROW) });
      }
    }
    
    result.push({ type: 'title', content: categoryName });
    for (let i = 0; i < icons.length; i += ICON_PER_ROW) {
      result.push({ type: 'icons', content: icons.slice(i, i + ICON_PER_ROW) });
    }
    
    return result;
  }, [icons, recentIconItems, categoryName]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'title' ? 28 : ICON_SIZE + ROW_GAP,
    overscan: 5,
  });

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-icon]') as HTMLElement;
    if (button?.dataset.icon && button?.dataset.color) {
      onSelect(button.dataset.icon, button.dataset.color);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-icon]') as HTMLElement;
    if (button?.dataset.icon && button?.dataset.color) {
      onPreview?.(`icon:${button.dataset.icon}:${button.dataset.color}`);
    }
  }, [onPreview]);

  const handleMouseLeave = useCallback(() => {
    onPreview?.(null);
  }, [onPreview]);

  return (
    <div
      ref={parentRef}
      className="h-[280px] overflow-auto neko-scrollbar"
      style={{ contain: 'strict' }}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-3 pt-2 pb-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {row.content as string}
                </div>
              ) : (
                <div className="px-3 flex gap-1">
                  {(row.content as IconItem[]).map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <button
                        key={item.name}
                        data-icon={item.name}
                        data-color={item.color}
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <IconComponent size={20} style={{ color: item.color }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VirtualSearchResults({
  results,
  skinTone,
  onSelect,
  onPreview,
}: {
  results: EmojiItem[];
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const emojisWithSkin = useMemo(() => {
    return results.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [results, skinTone]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'emojis'; content: string | string[] }[] = [];
    result.push({ type: 'title', content: `Results (${results.length})` });
    for (let i = 0; i < emojisWithSkin.length; i += EMOJI_PER_ROW) {
      result.push({ type: 'emojis', content: emojisWithSkin.slice(i, i + EMOJI_PER_ROW) });
    }
    return result;
  }, [emojisWithSkin, results.length]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'title' ? 28 : EMOJI_SIZE + ROW_GAP,
    overscan: 5,
  });

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    if (button?.dataset.emoji) {
      onSelect(button.dataset.emoji);
    }
  }, [onSelect]);

  const handleMouseOver = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest('[data-emoji]') as HTMLElement;
    onPreview?.(button?.dataset.emoji || null);
  }, [onPreview]);

  const handleMouseLeave = useCallback(() => {
    onPreview?.(null);
  }, [onPreview]);

  if (results.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center">
        <div className="text-zinc-400 dark:text-zinc-500 text-sm">No emoji found</div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[280px] overflow-auto neko-scrollbar"
      style={{ contain: 'strict' }}
      onClick={handleClick}
      onMouseOver={handleMouseOver}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-3 pt-2 pb-1 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  {row.content as string}
                </div>
              ) : (
                <div className="px-3 flex gap-0.5">
                  {(row.content as string[]).map((emoji, i) => (
                    <button
                      key={i}
                      data-emoji={emoji}
                      className="w-8 h-8 flex items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IconPicker({ onSelect, onPreview, onRemove, onClose, hasIcon = false, currentIcon, onIconChange }: IconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>(loadActiveTab);
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [searchQuery, setSearchQuery] = useState('');
  const [skinTone, setSkinTone] = useState(loadSkinTone);
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('people');
  const [activeIconCategory, setActiveIconCategory] = useState<string>('common');
  const [previewSkinTone, setPreviewSkinTone] = useState<number | null>(null);

  const recentIconsList = useMemo(() => 
    recentIcons.filter(i => i.startsWith('icon:')), 
    [recentIcons]
  );

  const effectiveSkinTone = previewSkinTone !== null ? previewSkinTone : skinTone;

  const getEmojiWithSkinTone = useCallback((emoji: string, tone: number): string | null => {
    if (!emoji || emoji.startsWith('icon:')) return null;
    const item = EMOJI_MAP.get(emoji);
    if (!item) return emoji;
    if (tone === 0 || !item.skins || item.skins.length <= tone) {
      return item.native;
    }
    return item.skins[tone]?.native || item.native;
  }, []);

  const handleSkinToneHover = useCallback((tone: number | null) => {
    setPreviewSkinTone(tone);
    if (tone !== null && currentIcon && !currentIcon.startsWith('icon:')) {
      const previewEmoji = getEmojiWithSkinTone(currentIcon, tone);
      if (previewEmoji) {
        onPreview?.(previewEmoji);
      }
    } else if (tone === null) {
      onPreview?.(null);
    }
  }, [currentIcon, getEmojiWithSkinTone, onPreview]);

  // 当前分类数据
  const currentCategory = useMemo(() => {
    return EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[0];
  }, [activeCategory]);

  // 搜索结果
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    const results: EmojiItem[] = [];
    for (const cat of EMOJI_CATEGORIES) {
      for (const emoji of cat.emojis) {
        if (
          emoji.name.toLowerCase().includes(query) ||
          emoji.id.toLowerCase().includes(query) ||
          emoji.keywords.some(k => k.toLowerCase().includes(query))
        ) {
          results.push(emoji);
          if (results.length >= 90) break;
        }
      }
      if (results.length >= 90) break;
    }
    return results;
  }, [searchQuery]);

  const recentEmojis = useMemo(() => 
    recentIcons.filter(i => !i.startsWith('icon:')).slice(0, MAX_RECENT_EMOJIS),
    [recentIcons]
  );

  const currentIconCategory = useMemo(() => {
    return ICON_CATEGORIES.find(c => c.id === activeIconCategory) || ICON_CATEGORIES[0];
  }, [activeIconCategory]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const updated = addToRecentIcons(emoji, recentIcons);
    setRecentIcons(updated);
    onSelect(emoji);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handlePreview = useCallback((emoji: string | null) => {
    onPreview?.(emoji);
  }, [onPreview]);

  const handleIconCategoryChange = useCallback((categoryId: string) => {
    setActiveIconCategory(categoryId);
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    saveActiveTab(tab);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onPreview?.(null);
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, onPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreview?.(null);
        onClose();
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const newTab = activeTab === 'emoji' ? 'icons' : 'emoji';
        handleTabChange(newTab);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onPreview, activeTab, handleTabChange]);

  useEffect(() => {
    if (activeTab === 'emoji') {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  const handleIconSelect = useCallback((iconName: string, color: string) => {
    const iconValue = `icon:${iconName}:${color}`;
    const updated = addToRecentIcons(iconValue, recentIcons);
    setRecentIcons(updated);
    onSelect(iconValue);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handleRemove = useCallback(() => {
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  const handleSkinToneChange = useCallback((tone: number) => {
    setSkinTone(tone);
    saveSkinTone(tone);
    setShowSkinTonePicker(false);
    setPreviewSkinTone(null);
    onPreview?.(null);
    if (currentIcon && !currentIcon.startsWith('icon:')) {
      const newEmoji = getEmojiWithSkinTone(currentIcon, tone);
      if (newEmoji && newEmoji !== currentIcon) {
        onIconChange?.(newEmoji);
      }
    }
  }, [currentIcon, getEmojiWithSkinTone, onIconChange, onPreview]);


  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute z-50 shadow-lg rounded-lg overflow-hidden",
        "border border-[var(--neko-border)] bg-white dark:bg-zinc-900",
        "w-[352px]"
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--neko-border)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleTabChange('emoji')}
            className={cn(
              "text-sm font-medium pb-1 border-b-2 transition-colors",
              activeTab === 'emoji'
                ? "text-[var(--neko-accent)] border-[var(--neko-accent)]"
                : "text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            Emoji
          </button>
          <button
            onClick={() => handleTabChange('icons')}
            className={cn(
              "text-sm font-medium pb-1 border-b-2 transition-colors",
              activeTab === 'icons'
                ? "text-[var(--neko-accent)] border-[var(--neko-accent)]"
                : "text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-300"
            )}
          >
            Icons
          </button>
        </div>
        {hasIcon && onRemove && (
          <button
            onClick={handleRemove}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {activeTab === 'emoji' ? (
        <div>
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-8 py-1.5 text-sm rounded-md",
                  searchQuery ? "pr-8" : "pr-3",
                  "bg-zinc-100 dark:bg-zinc-800",
                  "border border-transparent focus:border-[var(--neko-accent)]",
                  "outline-none transition-colors"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
                >
                  <IconX className="size-4" />
                </button>
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSkinTonePicker(!showSkinTonePicker)}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center text-base",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                )}
                title="Skin tone"
              >
                {SKIN_TONES[skinTone].emoji}
              </button>
              {showSkinTonePicker && (
                <div className={cn(
                  "absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10",
                  "bg-white dark:bg-zinc-800 border border-[var(--neko-border)]",
                  "flex gap-1"
                )}>
                  {SKIN_TONES.map((st) => (
                    <button
                      key={st.tone}
                      onClick={() => handleSkinToneChange(st.tone)}
                      onMouseEnter={() => handleSkinToneHover(st.tone)}
                      onMouseLeave={() => handleSkinToneHover(null)}
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center text-lg transition-all",
                        skinTone === st.tone 
                          ? "bg-zinc-200 dark:bg-zinc-700 scale-110" 
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:scale-105"
                      )}
                    >
                      {st.emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {searchQuery && searchResults ? (
            <VirtualSearchResults
              results={searchResults}
              skinTone={effectiveSkinTone}
              onSelect={handleEmojiSelect}
              onPreview={handlePreview}
            />
          ) : (
            <VirtualEmojiGrid
              key={activeCategory}
              emojis={currentCategory.emojis}
              skinTone={effectiveSkinTone}
              onSelect={handleEmojiSelect}
              onPreview={handlePreview}
              recentEmojis={recentEmojis}
              categoryName={currentCategory.name}
            />
          )}

          {!searchQuery && (
            <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
              {EMOJI_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors",
                    activeCategory === category.id
                      ? "bg-zinc-200 dark:bg-zinc-700"
                      : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                >
                  {CATEGORY_ICONS[category.id]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <VirtualIconGrid
            key={activeIconCategory}
            icons={currentIconCategory.icons}
            onSelect={handleIconSelect}
            onPreview={handlePreview}
            recentIcons={recentIconsList}
            categoryName={currentIconCategory.name}
          />
          <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
            {ICON_CATEGORIES.map((category) => {
              const IconComponent = typeof category.emoji !== 'string' 
                ? category.emoji as React.ComponentType<{ size?: number; className?: string }> 
                : null;
              return (
                <button
                  key={category.id}
                  onClick={() => handleIconCategoryChange(category.id)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors",
                    activeIconCategory === category.id
                      ? "bg-zinc-200 dark:bg-zinc-700"
                      : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                >
                  {IconComponent ? (
                    <IconComponent size={18} className="text-[#f59e0b]" />
                  ) : (
                    category.emoji as string
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
