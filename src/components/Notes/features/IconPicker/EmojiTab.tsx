/**
 * EmojiTab - Emoji picker tab with search and skin tone support
 */

import { useRef, useMemo, useCallback, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VirtualEmojiGrid, VirtualSearchResults } from './VirtualEmojiGrid';
import {
  EMOJI_CATEGORIES,
  EMOJI_MAP,
  CATEGORY_ICONS,
  SKIN_TONES,
  saveSkinTone,
  type EmojiItem,
} from './constants';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

interface EmojiTabProps {
  skinTone: number;
  setSkinTone: (tone: number) => void;
  recentEmojis: string[];
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  currentIcon?: string;
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function EmojiTab({
  skinTone,
  setSkinTone,
  recentEmojis,
  onSelect,
  onPreview,
  currentIcon,
  activeCategory,
  onCategoryChange,
}: EmojiTabProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);
  const [previewSkinTone, setPreviewSkinTone] = useState<number | null>(null);

  const updateAllEmojiSkinTones = useNotesStore(s => s.updateAllEmojiSkinTones);
  const setNotesPreviewSkinTone = useUIStore(s => s.setNotesPreviewSkinTone);

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
    setNotesPreviewSkinTone(tone);
    if (tone !== null && currentIcon && !currentIcon.startsWith('icon:')) {
      const previewEmoji = getEmojiWithSkinTone(currentIcon, tone);
      if (previewEmoji) {
        onPreview?.(previewEmoji);
      }
    } else if (tone === null) {
      onPreview?.(null);
    }
  }, [currentIcon, getEmojiWithSkinTone, onPreview, setNotesPreviewSkinTone]);

  const handleSkinToneChange = useCallback((tone: number) => {
    setSkinTone(tone);
    saveSkinTone(tone);
    setShowSkinTonePicker(false);
    setPreviewSkinTone(null);
    setNotesPreviewSkinTone(null);
    onPreview?.(null);
    // 更新所有笔记的 emoji 肤色
    updateAllEmojiSkinTones(tone);
  }, [setSkinTone, updateAllEmojiSkinTones, onPreview, setNotesPreviewSkinTone]);

  const currentCategory = useMemo(() => {
    return EMOJI_CATEGORIES.find(c => c.id === activeCategory) || EMOJI_CATEGORIES[0];
  }, [activeCategory]);

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

  const handlePreview = useCallback((emoji: string | null) => {
    onPreview?.(emoji);
  }, [onPreview]);

  return (
    <div>
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-zinc-400 dark:text-zinc-500" />
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
              "border border-transparent focus:border-zinc-300 dark:focus:border-zinc-600",
              "outline-none transition-colors"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowSkinTonePicker(!showSkinTonePicker)}
            className="w-7 h-7 flex items-center justify-center text-base opacity-60 hover:opacity-100 transition-opacity"
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
                    "w-7 h-7 flex items-center justify-center text-lg transition-all",
                    skinTone === st.tone
                      ? "opacity-100 scale-110"
                      : "opacity-60 hover:opacity-100 hover:scale-105"
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
          onSelect={onSelect}
          onPreview={handlePreview}
        />
      ) : (
        <VirtualEmojiGrid
          emojis={currentCategory.emojis}
          skinTone={effectiveSkinTone}
          onSelect={onSelect}
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
              onClick={() => onCategoryChange(category.id)}
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
  );
}
