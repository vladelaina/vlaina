import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Shuffle } from 'lucide-react';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useNotesStore } from '@/stores/useNotesStore';
import { PremiumSlider } from '@/components/ui/premium-slider';
import { EmojiTab } from './EmojiTab';
import { IconsTab } from './IconsTab';
import { UploadTab } from './UploadTab';
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
} from './constants';
import { ICON_CATEGORIES } from './icons';

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string;
  // Icon Resizing
  currentSize?: number;
  onSizeChange?: (size: number) => void;
  onSizeConfirm?: (size: number) => void;
}

export function IconPicker({
  onSelect,
  onPreview,
  onRemove,
  onClose,
  hasIcon = false,
  currentIcon,
  currentSize,
  onSizeChange,
  onSizeConfirm,
}: IconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>(loadActiveTab);
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [skinTone, setSkinTone] = useState(loadSkinTone);
  const [iconColor, setIconColor] = useState(loadIconColor);



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

  const handleIconColorChange = useCallback((colorId: number) => {
    setIconColor(colorId);
    saveIconColor(colorId);
  }, []);

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
        const currentColor = ICON_COLORS[iconColor]?.color || ICON_COLORS[0].color;
        const iconValue = `icon:${randomIcon.name}:${currentColor}`;
        lastRandomIconRef.current = iconValue;
        onSelect(iconValue);
      }
    } else if (activeTab === 'upload') {
      const workspaceEmojis = useNotesStore.getState().workspaceEmojis;
      if (workspaceEmojis.length > 0) {
        const randomEmoji = workspaceEmojis[Math.floor(Math.random() * workspaceEmojis.length)];
        lastRandomIconRef.current = randomEmoji.url;
        onSelect(randomEmoji.url);
      }
    }
  }, [activeTab, activeEmojiCategory, activeIconCategory, iconColor, onSelect]);

  useEffect(() => {
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
  }, [handleClose, onPreview]);

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
        "absolute z-50 flex flex-col gap-1 w-[352px]",
        // Prevent accidental closing when dragging
        "select-none"
      )}
    >
      {/* Block 1: The Detached Slider "Island" - Extreme Minimalist (No Bg, No Border) */}
      {onSizeChange && currentSize !== undefined && (
        <div
          className="flex items-center px-4 py-1"
          style={{ '--track-color': 'var(--neko-bg-tertiary)' } as React.CSSProperties}
        >
          <PremiumSlider
            min={20}
            max={150}
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
      <div className="flex flex-col bg-[var(--neko-bg-primary)] rounded-xl border border-[var(--neko-border)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--neko-border)] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-4">
            <button
              onClick={() => handleTabChange('emoji')}
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
              onClick={() => handleTabChange('icons')}
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
              onClick={() => handleTabChange('upload')}
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
              onClick={handleRandom}
              className={cn("p-1 -ml-1 flex items-center justify-center transition-all active:scale-90", iconButtonStyles)}
            >
              <Shuffle size={14} />
            </button>
          </div>
          {hasIcon && onRemove && (
            <button
              onClick={handleRemove}
              className="text-xs font-medium transition-all active:scale-95 text-[var(--neko-text-tertiary)] hover:text-red-500"
            >
              Remove
            </button>
          )}
        </div>

        {activeTab === 'emoji' ? (
          <EmojiTab
            skinTone={skinTone}
            setSkinTone={setSkinTone}
            recentEmojis={recentEmojis}
            onSelect={handleEmojiSelect}
            onPreview={onPreview}
            currentIcon={currentIcon}
            activeCategory={activeEmojiCategory}
            onCategoryChange={setActiveEmojiCategory}
          />
        ) : activeTab === 'icons' ? (
          <IconsTab
            recentIcons={recentIcons}
            onSelect={handleIconSelect}
            onPreview={onPreview}
            activeCategory={activeIconCategory}
            onCategoryChange={setActiveIconCategory}
            iconColor={iconColor}
            setIconColor={handleIconColorChange}
            currentIcon={currentIcon}
          />
        ) : (
          <UploadTab
            onSelect={handleUploadSelect}
            onPreview={onPreview}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
