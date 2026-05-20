import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { SidebarSearchField } from '@/components/layout/sidebar/SidebarPrimitives';
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
import { useI18n, type MessageKey } from '@/lib/i18n';

const EMOJI_CATEGORY_LABEL_KEYS: Record<string, MessageKey> = {
  frequent: 'icon.categoryRecent',
  people: 'icon.categorySmileysPeople',
  foods: 'icon.categoryFoodDrink',
  activity: 'icon.categoryActivity',
  places: 'icon.categoryTravelPlaces',
  objects: 'icon.categoryObjects',
  symbols: 'icon.categorySymbols',
  flags: 'icon.categoryFlags',
};

interface EmojiTabProps {
  skinTone: number;
  setSkinTone: (tone: number) => void;
  recentEmojis: string[];
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  
  onSkinToneChange?: (tone: number) => void;
  onPreviewSkinTone?: (tone: number | null) => void;

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
  onSkinToneChange,
  onPreviewSkinTone,
  currentIcon,
  activeCategory,
  onCategoryChange,
}: EmojiTabProps) {
  const { t } = useI18n();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const skinTonePickerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSkinTonePicker, setShowSkinTonePicker] = useState(false);
  const [previewSkinTone, setPreviewSkinTone] = useState<number | null>(null);

  const effectiveSkinTone = previewSkinTone !== null ? previewSkinTone : skinTone;

  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;

  const currentIconRef = useRef(currentIcon);
  currentIconRef.current = currentIcon;

  const onPreviewSkinToneRef = useRef(onPreviewSkinTone);
  onPreviewSkinToneRef.current = onPreviewSkinTone;

  const lastPreviewToneRef = useRef<number | null>(null);

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
          onPreviewSkinToneRef.current?.(tone);
          
          const icon = currentIconRef.current;
          if (icon && !icon.startsWith('icon:') && !icon.startsWith('img:')) {
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
        onPreviewSkinToneRef.current?.(null);
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
    
    onPreviewSkinTone?.(null);
    onPreview?.(null);
    
    onSkinToneChange?.(tone);
  }, [setSkinTone, onSkinToneChange, onPreview, onPreviewSkinTone]);

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
    onPreviewRef.current?.(emoji);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 px-1 pt-1 pb-2">
        <SidebarSearchField
          ref={searchInputRef}
          type="text"
          placeholder={t('icon.searchEmojis')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClose={() => setSearchQuery('')}
          closeLabel={t('icon.clearEmojiSearch')}
          className="min-w-0 flex-1 px-2 pt-2"
          containerClassName="h-8 gap-1.5 pl-2 pr-1"
          inputClassName="text-sm"
          closeButtonClassName={cn(
            'h-5 w-5',
            searchQuery ? undefined : 'invisible pointer-events-none',
          )}
        />

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
                "bg-white dark:bg-zinc-800 border border-[var(--vlaina-border)]",
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
          categoryId={currentCategory.id}
          categoryName={t(EMOJI_CATEGORY_LABEL_KEYS[currentCategory.id] ?? 'icon.categorySmileysPeople')}
        />
      )}

      {!searchQuery && (
        <div className="flex items-center justify-around px-2 py-1.5 border-t border-[var(--vlaina-border)] bg-zinc-50 dark:bg-zinc-800/50">
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
