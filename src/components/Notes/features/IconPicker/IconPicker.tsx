/**
 * IconPicker - Emoji and Icon picker for document icons
 * 
 * Custom implementation with full emoji support and hover preview
 */

import { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import data from '@emoji-mart/data';
import { cn } from '@/lib/utils';
import { IconSearch } from '@tabler/icons-react';
import {
  IconFileText,
  IconFolder,
  IconStar,
  IconHeart,
  IconBookmark,
  IconBulb,
  IconRocket,
  IconCode,
  IconBug,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconInfoCircle,
  IconQuestionMark,
  IconLock,
  IconKey,
  IconSettings,
  IconUser,
  IconUsers,
  IconHome,
  IconCalendar,
  IconClock,
  IconMail,
  IconPhone,
  IconCamera,
  IconPhoto,
  IconMusic,
  IconVideo,
  IconWorld,
  IconMap,
  IconFlag,
  IconTrophy,
  IconGift,
  IconShoppingCart,
  IconCreditCard,
  IconWallet,
  IconChartBar,
  IconDatabase,
  IconCloud,
  IconDownload,
  IconUpload,
  IconLink,
  IconPaperclip,
  IconPencil,
  IconTrash,
  IconArchive,
  IconClipboard,
  IconNote,
  IconBook,
  IconSchool,
  IconBriefcase,
  IconTools,
  IconPalette,
  IconBrush,
  IconFlask,
  IconAtom,
  IconPlant,
  IconLeaf,
  IconSun,
  IconMoon,
  IconBolt,
  IconFlame,
  IconDroplet,
  IconSnowflake,
} from '@tabler/icons-react';

type TabType = 'emoji' | 'icons';

// localStorage keys
const RECENT_ICONS_KEY = 'nekotick-recent-icons';
const SKIN_TONE_KEY = 'nekotick-emoji-skin-tone';
const MAX_RECENT_EMOJIS = 18; // 两行，每行9个

// 皮肤色调
const SKIN_TONES = [
  { tone: 0, color: '#ffc93a', label: '默认' },
  { tone: 1, color: '#fadcbc', label: '浅色' },
  { tone: 2, color: '#e0bb95', label: '中浅色' },
  { tone: 3, color: '#bf8f68', label: '中色' },
  { tone: 4, color: '#9b643d', label: '中深色' },
  { tone: 5, color: '#594539', label: '深色' },
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
    return [icon, ...icons.slice(0, MAX_RECENT_EMOJIS - 1), ...emojis];
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
  frequent: '最近使用',
  people: '表情与人物',
  nature: '动物与自然',
  foods: '食物与饮料',
  activity: '活动',
  places: '旅行与地点',
  objects: '物品',
  symbols: '符号',
  flags: '旗帜',
};

// 分类图标映射
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


function buildEmojiCategories(): EmojiCategory[] {
  const emojiData = data as any;
  const categories: EmojiCategory[] = [];
  
  for (const cat of emojiData.categories) {
    if (cat.id === 'frequent') continue;
    
    const emojis: EmojiItem[] = [];
    for (const emojiId of cat.emojis) {
      const emoji = emojiData.emojis[emojiId];
      if (emoji && emoji.skins && emoji.skins[0]) {
        emojis.push({
          id: emojiId,
          native: emoji.skins[0].native,
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

const ICON_LIST = [
  { name: 'file', icon: IconFileText, color: '#6366f1' },
  { name: 'folder', icon: IconFolder, color: '#f59e0b' },
  { name: 'star', icon: IconStar, color: '#eab308' },
  { name: 'heart', icon: IconHeart, color: '#ef4444' },
  { name: 'bookmark', icon: IconBookmark, color: '#8b5cf6' },
  { name: 'bulb', icon: IconBulb, color: '#f59e0b' },
  { name: 'rocket', icon: IconRocket, color: '#3b82f6' },
  { name: 'code', icon: IconCode, color: '#10b981' },
  { name: 'bug', icon: IconBug, color: '#ef4444' },
  { name: 'check', icon: IconCheck, color: '#22c55e' },
  { name: 'x', icon: IconX, color: '#ef4444' },
  { name: 'alert', icon: IconAlertCircle, color: '#f59e0b' },
  { name: 'info', icon: IconInfoCircle, color: '#3b82f6' },
  { name: 'question', icon: IconQuestionMark, color: '#8b5cf6' },
  { name: 'lock', icon: IconLock, color: '#6b7280' },
  { name: 'key', icon: IconKey, color: '#f59e0b' },
  { name: 'settings', icon: IconSettings, color: '#6b7280' },
  { name: 'user', icon: IconUser, color: '#3b82f6' },
  { name: 'users', icon: IconUsers, color: '#3b82f6' },
  { name: 'home', icon: IconHome, color: '#6366f1' },
  { name: 'calendar', icon: IconCalendar, color: '#ef4444' },
  { name: 'clock', icon: IconClock, color: '#6b7280' },
  { name: 'mail', icon: IconMail, color: '#3b82f6' },
  { name: 'phone', icon: IconPhone, color: '#22c55e' },
  { name: 'camera', icon: IconCamera, color: '#6b7280' },
  { name: 'photo', icon: IconPhoto, color: '#8b5cf6' },
  { name: 'music', icon: IconMusic, color: '#ec4899' },
  { name: 'video', icon: IconVideo, color: '#ef4444' },
  { name: 'world', icon: IconWorld, color: '#3b82f6' },
  { name: 'map', icon: IconMap, color: '#22c55e' },
  { name: 'flag', icon: IconFlag, color: '#ef4444' },
  { name: 'trophy', icon: IconTrophy, color: '#f59e0b' },
  { name: 'gift', icon: IconGift, color: '#ec4899' },
  { name: 'cart', icon: IconShoppingCart, color: '#6366f1' },
  { name: 'card', icon: IconCreditCard, color: '#6b7280' },
  { name: 'wallet', icon: IconWallet, color: '#f59e0b' },
  { name: 'chart', icon: IconChartBar, color: '#3b82f6' },
  { name: 'database', icon: IconDatabase, color: '#6b7280' },
  { name: 'cloud', icon: IconCloud, color: '#3b82f6' },
  { name: 'download', icon: IconDownload, color: '#22c55e' },
  { name: 'upload', icon: IconUpload, color: '#3b82f6' },
  { name: 'link', icon: IconLink, color: '#6366f1' },
  { name: 'clip', icon: IconPaperclip, color: '#6b7280' },
  { name: 'pencil', icon: IconPencil, color: '#f59e0b' },
  { name: 'trash', icon: IconTrash, color: '#ef4444' },
  { name: 'archive', icon: IconArchive, color: '#6b7280' },
  { name: 'clipboard', icon: IconClipboard, color: '#6366f1' },
  { name: 'note', icon: IconNote, color: '#f59e0b' },
  { name: 'book', icon: IconBook, color: '#8b5cf6' },
  { name: 'school', icon: IconSchool, color: '#3b82f6' },
  { name: 'briefcase', icon: IconBriefcase, color: '#6b7280' },
  { name: 'tools', icon: IconTools, color: '#6b7280' },
  { name: 'palette', icon: IconPalette, color: '#ec4899' },
  { name: 'brush', icon: IconBrush, color: '#8b5cf6' },
  { name: 'flask', icon: IconFlask, color: '#22c55e' },
  { name: 'atom', icon: IconAtom, color: '#3b82f6' },
  { name: 'plant', icon: IconPlant, color: '#22c55e' },
  { name: 'leaf', icon: IconLeaf, color: '#22c55e' },
  { name: 'sun', icon: IconSun, color: '#f59e0b' },
  { name: 'moon', icon: IconMoon, color: '#6366f1' },
  { name: 'bolt', icon: IconBolt, color: '#f59e0b' },
  { name: 'flame', icon: IconFlame, color: '#ef4444' },
  { name: 'droplet', icon: IconDroplet, color: '#3b82f6' },
  { name: 'snowflake', icon: IconSnowflake, color: '#06b6d4' },
];

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
}

const EmojiButton = memo(function EmojiButton({ 
  emoji, 
  onSelect, 
  onPreview 
}: { 
  emoji: string; 
  onSelect: (e: string) => void; 
  onPreview?: (e: string | null) => void;
}) {
  return (
    <button
      onClick={() => onSelect(emoji)}
      onMouseEnter={() => onPreview?.(emoji)}
      className="w-8 h-8 flex items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {emoji}
    </button>
  );
});


const EmojiCategorySection = memo(function EmojiCategorySection({
  category,
  skinTone,
  onSelect,
  onPreview,
  recentEmojis,
  categoryTitleRef,
}: {
  category: EmojiCategory;
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  recentEmojis: string[];
  categoryTitleRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const emojisWithSkin = useMemo(() => {
    return category.emojis.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [category.emojis, skinTone]);

  return (
    <div className="px-3 py-2">
      {recentEmojis.length > 0 && (
        <>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
            最近使用
          </div>
          <div className="grid grid-cols-9 gap-0.5 mb-3">
            {recentEmojis.slice(0, MAX_RECENT_EMOJIS).map((emoji, index) => (
              <EmojiButton
                key={`recent-${index}`}
                emoji={emoji}
                onSelect={onSelect}
                onPreview={onPreview}
              />
            ))}
          </div>
        </>
      )}
      
      <div 
        ref={categoryTitleRef}
        className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium"
      >
        {category.name}
      </div>
      <div className="grid grid-cols-9 gap-0.5">
        {emojisWithSkin.map((emoji, index) => (
          <EmojiButton
            key={category.emojis[index].id}
            emoji={emoji}
            onSelect={onSelect}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
});

export function IconPicker({ onSelect, onPreview, onRemove, onClose, hasIcon = false }: IconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryTitleRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('emoji');
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [searchQuery, setSearchQuery] = useState('');
  const [skinTone, setSkinTone] = useState(loadSkinTone);
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('people');

  // 切换分类时，非第一个分类自动滚动到分类标题
  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    // 如果不是第一个分类，等待渲染后滚动到分类标题
    if (categoryId !== 'people') {
      setTimeout(() => {
        if (categoryTitleRef.current && scrollContainerRef.current) {
          categoryTitleRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      }, 0);
    } else {
      // 第一个分类滚动到顶部
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }, 0);
    }
  }, []);

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
        }
      }
    }
    
    return results;
  }, [searchQuery]);

  const currentCategory = useMemo(() => {
    return EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[0];
  }, [activeCategory]);

  const recentEmojis = recentIcons.filter(i => !i.startsWith('icon:')).slice(0, MAX_RECENT_EMOJIS);
  const recentIconItems = recentIcons.filter(i => i.startsWith('icon:'));

  const handleEmojiSelect = useCallback((emoji: string) => {
    const updated = addToRecentIcons(emoji, recentIcons);
    setRecentIcons(updated);
    onSelect(emoji);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handlePreview = useCallback((emoji: string | null) => {
    onPreview?.(emoji);
  }, [onPreview]);

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
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPreview]);

  useEffect(() => {
    if (activeTab === 'emoji') {
      searchInputRef.current?.focus();
    }
  }, [activeTab]);

  const handleIconSelect = (iconName: string, color: string) => {
    const iconValue = `icon:${iconName}:${color}`;
    const updated = addToRecentIcons(iconValue, recentIcons);
    setRecentIcons(updated);
    onSelect(iconValue);
    onClose();
  };

  const handleRemove = () => {
    onRemove?.();
    onClose();
  };

  const handleSkinToneChange = (tone: number) => {
    setSkinTone(tone);
    saveSkinTone(tone);
    setShowSkinTonePicker(false);
  };


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
            onClick={() => setActiveTab('emoji')}
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
            onClick={() => setActiveTab('icons')}
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
                placeholder="搜索 emoji..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "w-full pl-8 pr-3 py-1.5 text-sm rounded-md",
                  "bg-zinc-100 dark:bg-zinc-800",
                  "border border-transparent focus:border-[var(--neko-accent)]",
                  "outline-none transition-colors"
                )}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSkinTonePicker(!showSkinTonePicker)}
                className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center",
                  "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                )}
                title="选择皮肤色调"
              >
                <span 
                  className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-600"
                  style={{ backgroundColor: SKIN_TONES[skinTone].color }}
                />
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
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all",
                        skinTone === st.tone 
                          ? "border-[var(--neko-accent)] scale-110" 
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: st.color }}
                      title={st.label}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div 
            ref={scrollContainerRef}
            className="max-h-[280px] overflow-y-auto neko-scrollbar"
            onMouseLeave={() => onPreview?.(null)}
          >
            {searchQuery && searchResults && (
              <div className="px-3 py-2">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
                  搜索结果 ({searchResults.length})
                </div>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-9 gap-0.5">
                    {searchResults.slice(0, 90).map((emoji) => {
                      const displayEmoji = skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone
                        ? emoji.native
                        : emoji.skins[skinTone]?.native || emoji.native;
                      return (
                        <EmojiButton
                          key={emoji.id}
                          emoji={displayEmoji}
                          onSelect={handleEmojiSelect}
                          onPreview={handlePreview}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-zinc-400 dark:text-zinc-500 text-sm">
                    没有找到匹配的 emoji
                  </div>
                )}
              </div>
            )}
            
            {!searchQuery && currentCategory && (
              <EmojiCategorySection
                key={currentCategory.id}
                category={currentCategory}
                skinTone={skinTone}
                onSelect={handleEmojiSelect}
                onPreview={handlePreview}
                recentEmojis={recentEmojis}
                categoryTitleRef={categoryTitleRef}
              />
            )}
          </div>

          {!searchQuery && (
            <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
              {EMOJI_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-md text-lg transition-colors",
                    activeCategory === category.id
                      ? "bg-zinc-200 dark:bg-zinc-700"
                      : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  )}
                  title={category.name}
                >
                  {CATEGORY_ICONS[category.id]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div 
          className="p-3 max-h-[320px] overflow-y-auto neko-scrollbar"
          onMouseLeave={() => onPreview?.(null)}
        >
          {recentIconItems.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
                最近使用
              </div>
              <div className="grid grid-cols-8 gap-1">
                {recentIconItems.map((iconValue, index) => {
                  const parts = iconValue.split(':');
                  const iconName = parts[1];
                  const color = parts[2] || '#6b7280';
                  const iconItem = ICON_LIST.find(i => i.name === iconName);
                  if (!iconItem) return null;
                  const IconComponent = iconItem.icon;
                  return (
                    <button
                      key={`recent-icon-${index}`}
                      onClick={() => handleIconSelect(iconName, color)}
                      onMouseEnter={() => onPreview?.(iconValue)}
                      className={cn(
                        "w-9 h-9 flex items-center justify-center rounded-md",
                        "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      )}
                    >
                      <IconComponent size={20} style={{ color }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
            全部图标
          </div>
          <div className="grid grid-cols-8 gap-1">
            {ICON_LIST.map((item) => {
              const IconComponent = item.icon;
              const iconValue = `icon:${item.name}:${item.color}`;
              return (
                <button
                  key={item.name}
                  onClick={() => handleIconSelect(item.name, item.color)}
                  onMouseEnter={() => onPreview?.(iconValue)}
                  className={cn(
                    "w-9 h-9 flex items-center justify-center rounded-md",
                    "hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  )}
                >
                  <IconComponent size={20} style={{ color: item.color }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
