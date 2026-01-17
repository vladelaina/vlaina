/**
 * EmojiTab - Emoji picker tab with search and skin tone support
 */

import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
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
  const skinTonePickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);
  const [previewSkinTone, setPreviewSkinTone] = useState<number | null>(null);

  const updateAllEmojiSkinTones = useNotesStore(s => s.updateAllEmojiSkinTones);
  const setNotesPreviewSkinTone = useUIStore(s => s.setNotesPreviewSkinTone);

  const effectiveSkinTone = previewSkinTone !== null ? previewSkinTone : skinTone;

  // Use ref to store callbacks and state to avoid dependency changes
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  const currentIconRef = useRef(currentIcon);
  currentIconRef.current = currentIcon;

  const setNotesPreviewSkinToneRef = useRef(setNotesPreviewSkinTone);
  setNotesPreviewSkinToneRef.current = setNotesPreviewSkinTone;

  // Track last previewed skin tone to avoid duplicate updates
  const lastPreviewToneRef = useRef<number | null>(null);

  // Use native event handling for skin tone hover to bypass React synthetic event system
  useEffect(() => {
    const container = skinTonePickerRef.current;
    if (!container || !showSkinTonePicker) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-tone]') as HTMLElement;
      if (button?.dataset.tone) {
        const tone = parseInt(button.dataset.tone, 10);
        if (tone !== lastPreviewToneRef.current) {
          lastPreviewToneRef.current = tone;
          setPreviewSkinTone(tone);
          setNotesPreviewSkinToneRef.current(tone);
          // Also preview current note's emoji
          const icon = currentIconRef.current;
          if (icon && !icon.startsWith('icon:')) {
            const item = EMOJI_MAP.get(icon);
            if (item) {
              const previewEmoji = tone === 0 || !item.skins || item.skins.length <= tone
                ? item.native
                : (item.skins[tone]?.native || item.native);
              onPreviewRef.current?.(previewEmoji);
            }
          }
        }
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewToneRef.current !== null) {
        lastPreviewToneRef.current = null;
        setPreviewSkinTone(null);
        setNotesPreviewSkinToneRef.current(null);
        onPreviewRef.current?.(null);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [showSkinTonePicker]);

  const handleSkinToneChange = useCallback((tone: number) => {
    setSkinTone(tone);
    saveSkinTone(tone);
    setShowSkinTonePicker(false);
    setPreviewSkinTone(null);
    lastPreviewToneRef.current = null;
    setNotesPreviewSkinTone(null);
    onPreview?.(null);
    // Update all notes' emoji skin tones
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

  // Stable handlePreview callback
  const handlePreview = useCallback((emoji: string | null) => {
    onPreviewRef.current?.(emoji);
  }, []);

  return (
    <div>
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[var(--neko-text-tertiary)]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Filter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-8 py-1 h-8 text-sm rounded-md",
              searchQuery ? "pr-8" : "pr-3",
              "bg-white dark:bg-zinc-900",
              "border border-zinc-200 dark:border-zinc-700 focus:border-[#1e96eb]",
              "outline-none transition-all"
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--neko-text-tertiary)] hover:text-[var(--neko-text-primary)] transition-colors"
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
            <div
              ref={skinTonePickerRef}
              className={cn(
                "absolute right-0 top-full mt-1 p-2 rounded-lg shadow-lg z-10",
                "bg-white dark:bg-zinc-800 border border-[var(--neko-border)]",
                "flex gap-1"
              )}
            >
              {SKIN_TONES.map((st) => (
                <button
                  key={st.tone}
                  data-tone={st.tone}
                  onClick={() => handleSkinToneChange(st.tone)}
                  className="w-7 h-7 flex items-center justify-center text-lg"
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
