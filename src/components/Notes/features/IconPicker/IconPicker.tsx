/**
 * IconPicker - Emoji and Icon picker for document icons
 * 
 * Custom implementation with full emoji support and hover preview
 */

import { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import data from '@emoji-mart/data';
import { cn } from '@/lib/utils';
import { IconSearch, IconX } from '@tabler/icons-react';
import { ICON_CATEGORIES, ICON_LIST } from './icons';

export { ICON_LIST };

type TabType = 'emoji' | 'icons';

// localStorage keys
const RECENT_ICONS_KEY = 'nekotick-recent-icons';
const SKIN_TONE_KEY = 'nekotick-emoji-skin-tone';
const MAX_RECENT_EMOJIS = 18; // 两行，每行9个

// Skin tones - using waving hand emoji
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

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string; // 当前已应用的图标，用于肤色预览
  onIconChange?: (emoji: string) => void; // 更新图标但不关闭 picker（用于肤色切换）
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
  showRecent = true,
}: {
  category: EmojiCategory;
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  recentEmojis: string[];
  categoryTitleRef?: React.RefObject<HTMLDivElement | null>;
  showRecent?: boolean;
}) {
  const emojisWithSkin = useMemo(() => {
    return category.emojis.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [category.emojis, skinTone]);

  // 将最近使用的 emoji 转换为当前皮肤色调
  const recentEmojisWithSkin = useMemo(() => {
    return recentEmojis.map(emoji => {
      // 查找这个 emoji 对应的数据
      for (const cat of EMOJI_CATEGORIES) {
        for (const item of cat.emojis) {
          // 检查是否匹配（可能是默认版本或任何皮肤版本）
          if (item.native === emoji || item.skins?.some(s => s.native === emoji)) {
            if (skinTone === 0 || !item.skins || item.skins.length <= skinTone) {
              return item.native;
            }
            return item.skins[skinTone]?.native || item.native;
          }
        }
      }
      return emoji; // 找不到就返回原 emoji
    });
  }, [recentEmojis, skinTone]);

  return (
    <div className="px-3 py-2">
      {showRecent && recentEmojis.length > 0 && (
        <>
          <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
            Recent
          </div>
          <div className="grid grid-cols-9 gap-0.5 mb-3">
            {recentEmojisWithSkin.slice(0, MAX_RECENT_EMOJIS).map((emoji, index) => (
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

export function IconPicker({ onSelect, onPreview, onRemove, onClose, hasIcon = false, currentIcon, onIconChange }: IconPickerProps) {
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
  const [activeIconCategory, setActiveIconCategory] = useState<string>('common');
  const [previewSkinTone, setPreviewSkinTone] = useState<number | null>(null); // 预览肤色
  const iconScrollContainerRef = useRef<HTMLDivElement>(null);

  // 实际使用的肤色（预览优先）
  const effectiveSkinTone = previewSkinTone !== null ? previewSkinTone : skinTone;

  // 根据 emoji 和肤色获取对应版本
  const getEmojiWithSkinTone = useCallback((emoji: string, tone: number): string | null => {
    if (!emoji || emoji.startsWith('icon:')) return null;
    
    // 从 emoji-mart data 查找这个 emoji
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (item.native === emoji || item.skins?.some((s: any) => s.native === emoji)) {
          if (tone === 0 || !item.skins || item.skins.length <= tone) {
            return item.native;
          }
          return item.skins[tone]?.native || item.native;
        }
      }
    }
    return emoji; // 找不到就返回原 emoji
  }, []);

  // 悬浮肤色时预览当前图标的对应肤色版本
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

  // 切换分类时，非第一个分类自动滚动到分类标题
  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    // 使用 requestAnimationFrame 确保 DOM 更新后立即滚动
    requestAnimationFrame(() => {
      if (categoryId !== 'people') {
        if (categoryTitleRef.current && scrollContainerRef.current) {
          categoryTitleRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      } else {
        // 第一个分类滚动到顶部
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    });
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

  const recentEmojis = recentIcons.filter(i => !i.startsWith('icon:')).slice(0, MAX_RECENT_EMOJIS);

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

  // 切换 Icon 分类时滚动到顶部
  const handleIconCategoryChange = useCallback((categoryId: string) => {
    setActiveIconCategory(categoryId);
    requestAnimationFrame(() => {
      if (iconScrollContainerRef.current) {
        iconScrollContainerRef.current.scrollTop = 0;
      }
    });
  }, []);

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
    setPreviewSkinTone(null);
    onPreview?.(null); // 清除父组件的预览状态
    
    // 如果当前有图标，更新为对应肤色版本（不关闭 picker）
    if (currentIcon && !currentIcon.startsWith('icon:')) {
      const newEmoji = getEmojiWithSkinTone(currentIcon, tone);
      if (newEmoji && newEmoji !== currentIcon) {
        onIconChange?.(newEmoji);
      }
    }
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

          <div 
            ref={scrollContainerRef}
            className="max-h-[280px] overflow-y-auto neko-scrollbar"
            onMouseLeave={() => onPreview?.(null)}
          >
            {searchQuery && searchResults && (
              <div className="px-3 py-2">
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
                  Results ({searchResults.length})
                </div>
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-9 gap-0.5">
                    {searchResults.slice(0, 90).map((emoji) => {
                      const displayEmoji = effectiveSkinTone === 0 || !emoji.skins || emoji.skins.length <= effectiveSkinTone
                        ? emoji.native
                        : emoji.skins[effectiveSkinTone]?.native || emoji.native;
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
                    No emoji found
                  </div>
                )}
              </div>
            )}
            
            {/* 预渲染所有分类，但只显示当前分类 */}
            {!searchQuery && EMOJI_CATEGORIES.map((category, index) => (
              <div 
                key={category.id} 
                style={{ display: activeCategory === category.id ? 'block' : 'none' }}
              >
                <EmojiCategorySection
                  category={category}
                  skinTone={effectiveSkinTone}
                  onSelect={handleEmojiSelect}
                  onPreview={handlePreview}
                  recentEmojis={recentEmojis}
                  categoryTitleRef={activeCategory === category.id ? categoryTitleRef : undefined}
                  showRecent={index === 0 || activeCategory === category.id}
                />
              </div>
            ))}
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
                >
                  {CATEGORY_ICONS[category.id]}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div 
            ref={iconScrollContainerRef}
            className="p-3 max-h-[280px] overflow-y-auto neko-scrollbar"
            onMouseLeave={() => onPreview?.(null)}
          >
            {ICON_CATEGORIES.map((category) => (
              <div 
                key={category.id}
                style={{ display: activeIconCategory === category.id ? 'block' : 'none' }}
              >
                <div className="text-xs text-zinc-400 dark:text-zinc-500 mb-2 font-medium">
                  {category.name}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {category.icons.map((item) => {
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
            ))}
          </div>
          <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--neko-border)] bg-zinc-50 dark:bg-zinc-800/50">
            {ICON_CATEGORIES.map((category) => {
              const isComponent = typeof category.emoji !== 'string';
              const IconComponent = isComponent ? category.emoji as React.ComponentType<{ size?: number; className?: string }> : null;
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
                  {isComponent && IconComponent ? (
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
