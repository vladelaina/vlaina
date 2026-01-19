import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Shuffle } from 'lucide-react';
import { cn, iconButtonStyles } from '@/lib/utils';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { EmojiTab } from './EmojiTab';
import { IconsTab } from './IconsTab';
import { UploadTab, type CustomIcon } from './UploadTab';
import {
  type TabType,
  loadRecentIcons,
  loadSkinTone,
  loadActiveTab,
  saveActiveTab,
  addToRecentIcons,
  loadIconColor,
  saveIconColor,
  ICON_COLORS,
  MAX_RECENT_EMOJIS,
  EMOJI_CATEGORIES,
  ICON_CATEGORIES,
} from './constants';
import type { ItemColor } from '@/lib/colors/index';
import { COLOR_HEX } from '@/lib/colors/index';

export interface UniversalIconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string;
  
  // Icon Resizing
  currentSize?: number;
  minSize?: number;
  maxSize?: number;
  onSizeChange?: (size: number) => void;
  onSizeConfirm?: (size: number) => void;
  
  // Custom Icons / Upload Support
  customIcons?: CustomIcon[];
  onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onDeleteCustomIcon?: (id: string) => void;
  
  // Callbacks for global preferences (optional)
  onSkinToneChange?: (tone: number) => void;
  onIconColorChange?: (color: string) => void;
  
  // Preview State Notifications (optional)
  onPreviewSkinTone?: (tone: number | null) => void;
  onPreviewColor?: (color: string | null) => void;

  // Style overrides
  embedded?: boolean;
  
  // Image Loading
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
  onIconColorChange,
  onPreviewSkinTone,
  onPreviewColor,

  embedded = false,
  imageLoader,
}: UniversalIconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>(loadActiveTab);
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [skinTone, setSkinTone] = useState(loadSkinTone);
  const [iconColor, setIconColor] = useState<ItemColor>(loadIconColor);

  // Track active categories for random selection within current group
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>('people');
  const [activeIconCategory, setActiveIconCategory] = useState<string>('common');

  // Track the last randomly selected icon (to add to recent on close)
  const lastRandomIconRef = useRef<string | null>(null);

  const recentEmojis = useMemo(() =>
    recentIcons.filter(i => !i.startsWith('icon:') && !i.startsWith('img:')).slice(0, MAX_RECENT_EMOJIS),
    [recentIcons]
  );

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    saveActiveTab(tab);
  }, []);

  // Use ref to store latest recentIcons to avoid callback dependency changes
  const recentIconsRef = useRef(recentIcons);
  recentIconsRef.current = recentIcons;

  const handleEmojiSelect = useCallback((emoji: string) => {
    lastRandomIconRef.current = null;
    const updated = addToRecentIcons(emoji, recentIconsRef.current);
    setRecentIcons(updated);
    onSelect(emoji);
    onClose();
  }, [onSelect, onClose]);

  const handleIconSelect = useCallback((iconName: string, color: string) => {
    lastRandomIconRef.current = null;
    const iconValue = `icon:${iconName}:${color}`;
    const updated = addToRecentIcons(iconValue, recentIconsRef.current);
    setRecentIcons(updated);
    onSelect(iconValue);
    onClose();
  }, [onSelect, onClose]);

  const handleIconColorChangeInternal = useCallback((color: ItemColor) => {
    setIconColor(color);
    saveIconColor(color);
    
    // Notify parent
    const hexColor = COLOR_HEX[color] || COLOR_HEX['default'];
    onIconColorChange?.(hexColor);
  }, [onIconColorChange]);
  
  const handleSkinToneChangeInternal = useCallback((tone: number) => {
    setSkinTone(tone);
    // saveSkinTone is handled in EmojiTab, but we update local state
    onSkinToneChange?.(tone);
  }, [onSkinToneChange]);

  const handleUploadSelect = useCallback((assetUrl: string) => {
    lastRandomIconRef.current = null;
    // Add custom image to recents as well
    const updated = addToRecentIcons(assetUrl, recentIconsRef.current);
    setRecentIcons(updated);
    onSelect(assetUrl);
    // UploadTab handles closing itself usually, but we ensure consistency
    onClose();
  }, [onSelect, onClose]);

  const handleRemove = useCallback(() => {
    lastRandomIconRef.current = null;
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  // Add random icon to recent when closing (if user kept it)
  const handleClose = useCallback(() => {
    if (lastRandomIconRef.current) {
      const updated = addToRecentIcons(lastRandomIconRef.current, recentIconsRef.current);
      setRecentIcons(updated);
      lastRandomIconRef.current = null;
    }
    onClose();
  }, [onClose]);

  // Random selection within current category only
  const handleRandom = useCallback(() => {
    if (activeTab === 'emoji') {
      const currentCategory = EMOJI_CATEGORIES.find(c => c.id === activeEmojiCategory);
      const emojis = currentCategory?.emojis || [];
      if (emojis.length > 0) {
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        lastRandomIconRef.current = randomEmoji.native;
        onSelect(randomEmoji.native);
      }
    } else if (activeTab === 'icons') {
      const currentCategory = ICON_CATEGORIES.find(c => c.id === activeIconCategory);
      const icons = currentCategory?.icons || [];
      if (icons.length > 0) {
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        const currentColorHex = COLOR_HEX[iconColor] || COLOR_HEX['default'];
        const iconValue = `icon:${randomIcon.name}:${currentColorHex}`;
        lastRandomIconRef.current = iconValue;
        onSelect(iconValue);
      }
    } else if (activeTab === 'upload') {
      if (customIcons.length > 0) {
        const randomEmoji = customIcons[Math.floor(Math.random() * customIcons.length)];
        lastRandomIconRef.current = randomEmoji.url;
        onSelect(randomEmoji.url);
      }
    }
  }, [activeTab, activeEmojiCategory, activeIconCategory, iconColor, onSelect, customIcons]);

  useEffect(() => {
    // If embedded, let the parent container (e.g. Popover) handle closing
    if (embedded) return;

    const onClickOutside = (e: MouseEvent) => {
      // Don't close if interacting with the cropper or sliders (which might portal or just look outside)
      // But standard logic usually applies.
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onPreview?.(null);
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
  }, [handleClose, onPreview, embedded]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreview?.(null);
        handleClose();
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const tabs: TabType[] = ['emoji', 'icons', 'upload'];
        const currentIndex = tabs.indexOf(activeTab);
        const nextIndex = (currentIndex + 1) % tabs.length;
        handleTabChange(tabs[nextIndex]);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [handleClose, onPreview, activeTab, handleTabChange]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col gap-1 w-[352px] select-none",
        !embedded && "absolute z-50",
      )}
    >
      {/* Block 1: The Detached Slider "Island" - Extreme Minimalist (No Bg, No Border) */}
      {onSizeChange && currentSize !== undefined && (
        <div
          className="flex items-center px-4 py-1"
          style={{ '--track-color': 'var(--neko-bg-tertiary)' } as React.CSSProperties}
        >
          <PremiumSlider
            min={minSize}
            max={maxSize}
            value={currentSize}
            onChange={(newVal: number) => {
              // DIRECT UPDATE: Do NOT set local state here.
              // We trust PremiumSlider to update its own visual thumb.
              // We only push the side effect (CSS update) to the parent Ref.
              onSizeChange(newVal);
            }}
            onConfirm={onSizeConfirm}
          />
        </div>
      )}

      {/* Block 2: The Main Content Window */}
      <div className={cn(
        "flex flex-col bg-[var(--neko-bg-primary)] overflow-hidden",
        !embedded && "rounded-xl border border-[var(--neko-border)] shadow-xl"
      )}>
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--neko-border)] overflow-x-auto no-scrollbar">
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
                  ? "text-[var(--neko-text-primary)] border-[#1e96eb]"
                  : "text-[var(--neko-text-tertiary)] border-transparent hover:text-[var(--neko-text-primary)]"
              )}
            >
              Emoji
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTabChange('icons');
              }}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-all active:scale-95 whitespace-nowrap",
                activeTab === 'icons'
                  ? "text-[var(--neko-text-primary)] border-[#1e96eb]"
                  : "text-[var(--neko-text-tertiary)] border-transparent hover:text-[var(--neko-text-primary)]"
              )}
            >
              Icons
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
                  ? "text-[var(--neko-text-primary)] border-[#1e96eb]"
                  : "text-[var(--neko-text-tertiary)] border-transparent hover:text-[var(--neko-text-primary)]"
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
              <Shuffle size={14} />
            </button>
          </div>
          {hasIcon && onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleRemove();
              }}
              className="text-xs font-medium transition-all active:scale-95 text-[var(--neko-text-tertiary)] hover:text-red-500"
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
        ) : activeTab === 'icons' ? (
          <IconsTab
            recentIcons={recentIcons}
            onSelect={handleIconSelect}
            onPreview={onPreview}
            activeCategory={activeIconCategory}
            onCategoryChange={setActiveIconCategory}
            iconColor={iconColor}
            setIconColor={handleIconColorChangeInternal}
            currentIcon={currentIcon}
            onIconColorChange={onIconColorChange}
            onPreviewColor={onPreviewColor}
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
