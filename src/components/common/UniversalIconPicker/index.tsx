import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn, iconButtonStyles } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { EmojiTab } from './EmojiTab';
import { UploadTab, type CustomIcon } from './UploadTab';
import {
  TabType,
  loadActiveTab,
  saveActiveTab,
  loadRecentIcons,
  addToRecentIcons,
  MAX_RECENT_EMOJIS,
  loadSkinTone,
  EMOJI_CATEGORIES,
} from './constants';

export interface UniversalIconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string;
  currentSize?: number;
  minSize?: number;
  maxSize?: number;
  onSizeChange?: (size: number) => void;
  onSizeConfirm?: (size: number) => void;
  customIcons?: CustomIcon[];
  onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onDeleteCustomIcon?: (id: string) => void;
  onSkinToneChange?: (tone: number) => void;
  onPreviewSkinTone?: (tone: number | null) => void;
  embedded?: boolean;
  imageLoader?: (src: string) => Promise<string>;
}

export function UniversalIconPicker({
  onSelect,
  onPreview,
  onRemove,
  onClose,
  hasIcon = false,
  currentIcon,
  currentSize,
  minSize = 20,
  maxSize = 150,
  onSizeChange,
  onSizeConfirm,
  
  customIcons = [],
  onUploadFile,
  onDeleteCustomIcon,
  
  onSkinToneChange,
  onPreviewSkinTone,

  embedded = false,
  imageLoader,
}: UniversalIconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onPreviewRef = useRef(onPreview);
  const [activeTab, setActiveTab] = useState<TabType>(loadActiveTab);
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [skinTone, setSkinTone] = useState(loadSkinTone);

  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>('people');
  const lastRandomIconRef = useRef<string | null>(null);

  const recentEmojis = useMemo(() =>
    recentIcons.filter(i => !i.startsWith('icon:') && !i.startsWith('img:')).slice(0, MAX_RECENT_EMOJIS),
    [recentIcons]
  );

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    saveActiveTab(tab);
  }, []);

  const recentIconsRef = useRef(recentIcons);
  recentIconsRef.current = recentIcons;
  onCloseRef.current = onClose;
  onPreviewRef.current = onPreview;

  const handleEmojiSelect = useCallback((emoji: string) => {
    lastRandomIconRef.current = null;
    const updated = addToRecentIcons(emoji, recentIconsRef.current);
    setRecentIcons(updated);
    onSelect(emoji);
    onCloseRef.current();
  }, [onSelect]);
  
  const handleSkinToneChangeInternal = useCallback((tone: number) => {
    setSkinTone(tone);
    onSkinToneChange?.(tone);
  }, [onSkinToneChange]);

  const handleUploadSelect = useCallback((assetUrl: string) => {
    lastRandomIconRef.current = null;
    const updated = addToRecentIcons(assetUrl, recentIconsRef.current);
    setRecentIcons(updated);
    onSelect(assetUrl);
    onCloseRef.current();
  }, [onSelect]);

  const removeTriggeredRef = useRef(false);

  const handleRemove = useCallback(() => {
    if (removeTriggeredRef.current) return;
    removeTriggeredRef.current = true;
    lastRandomIconRef.current = null;
    onPreviewRef.current?.(null);
    onPreviewSkinTone?.(null);
    onRemove?.();
    onCloseRef.current();
  }, [onPreviewSkinTone, onRemove]);

  const handleClose = useCallback(() => {
    if (lastRandomIconRef.current) {
      const updated = addToRecentIcons(lastRandomIconRef.current, recentIconsRef.current);
      setRecentIcons(updated);
      lastRandomIconRef.current = null;
    }
    onCloseRef.current();
  }, []);

  const handleRemoveEvent = useCallback((event: React.SyntheticEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    handleRemove();
  }, [handleRemove]);

  const handleRandom = useCallback(() => {
    if (activeTab === 'emoji') {
      const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory);
      const emojis = currentCategory?.emojis || [];
      if (emojis.length > 0) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        lastRandomIconRef.current = randomEmoji.native;
        onSelect(randomEmoji.native);
      }
    } else if (activeTab === 'upload') {
      if (customIcons.length > 0) {
        const randomEmoji = customIcons[Math.floor(Math.random() * customIcons.length)];
        lastRandomIconRef.current = randomEmoji.url;
        onSelect(randomEmoji.url);
      }
    }
  }, [activeTab, activeEmojiCategory, onSelect, customIcons]);

  useEffect(() => {
    if (embedded) return;

    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-prevent-picker-close]')) return;
      if (containerRef.current && !containerRef.current.contains(target as Node)) {
        onPreviewRef.current?.(null);
        handleClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [handleClose, embedded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreviewRef.current?.(null);
        handleClose();
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const tabs: TabType[] = ['emoji', 'upload'];
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        handleTabChange(tabs[nextIndex]);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [handleClose, activeTab, handleTabChange]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col gap-1 w-[352px] select-none",
        !embedded && "absolute z-50",
      )}
    >
      {onSizeChange && currentSize !== undefined && (
        <div
          className="flex items-center px-4 py-1"
          style={{ '--track-color': 'var(--vlaina-bg-tertiary)' } as React.CSSProperties}
        >
          <PremiumSlider
            min={minSize}
            max={maxSize}
            value={currentSize}
            onChange={(newVal: number) => {
              onSizeChange(newVal);
            }}
            onConfirm={onSizeConfirm}
          />
        </div>
      )}

      <div className={cn(
        "flex flex-col bg-[var(--vlaina-bg-primary)] overflow-hidden",
        !embedded && "rounded-xl border border-[var(--vlaina-border)] shadow-xl"
      )}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--vlaina-border)] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTabChange('emoji');
              }}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-all active:scale-95 whitespace-nowrap",
                activeTab === 'emoji'
                  ? "text-[var(--vlaina-text-primary)] border-[#1e96eb]"
                  : "text-[var(--vlaina-text-tertiary)] border-transparent hover:text-[var(--vlaina-text-primary)]"
              )}
            >
              Emoji
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTabChange('upload');
              }}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-all active:scale-95 whitespace-nowrap",
                activeTab === 'upload'
                  ? "text-[var(--vlaina-text-primary)] border-[#1e96eb]"
                  : "text-[var(--vlaina-text-tertiary)] border-transparent hover:text-[var(--vlaina-text-primary)]"
              )}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRandom();
              }}
              className={cn("p-1 -ml-1 flex items-center justify-center transition-all active:scale-90", iconButtonStyles)}
            >
              <Icon name="misc.shuffle" size="md" />
            </button>
          </div>
          {hasIcon && onRemove && (
            <button
              type="button"
              onPointerDown={handleRemoveEvent}
              onMouseDown={handleRemoveEvent}
              onClick={handleRemoveEvent}
              className="text-xs font-medium transition-all active:scale-95 text-[var(--vlaina-text-tertiary)] hover:text-red-500"
            >
              Remove
            </button>
          )}
        </div>

        {activeTab === 'emoji' ? (
          <EmojiTab
            skinTone={skinTone}
            setSkinTone={handleSkinToneChangeInternal}
            recentEmojis={recentEmojis}
            onSelect={handleEmojiSelect}
            onPreview={onPreview}
            currentIcon={currentIcon}
            activeCategory={activeEmojiCategory}
            onCategoryChange={setActiveEmojiCategory}
            onSkinToneChange={handleSkinToneChangeInternal}
            onPreviewSkinTone={onPreviewSkinTone}
          />
        ) : (
          <UploadTab
            onSelect={handleUploadSelect}
            onPreview={onPreview}
            onClose={onClose}
            customIcons={customIcons}
            onUploadFile={onUploadFile}
            onDeleteCustomIcon={onDeleteCustomIcon}
            imageLoader={imageLoader}
          />
        )}
      </div>
    </div>
  );
}
