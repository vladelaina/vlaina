/** IconPicker - Emoji and Icon picker with virtual scrolling */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmojiTab } from './EmojiTab';
import { IconsTab } from './IconsTab';
import {
  type TabType,
  loadRecentIcons,
  loadSkinTone,
  loadActiveTab,
  saveActiveTab,
  addToRecentIcons,
  loadIconColor,
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
}

export function IconPicker({
  onSelect,
  onPreview,
  onRemove,
  onClose,
  hasIcon = false,
  currentIcon,
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
    recentIcons.filter(i => !i.startsWith('icon:')).slice(0, MAX_RECENT_EMOJIS),
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
    } else {
      const currentCategory = ICON_CATEGORIES.find(c => c.id === activeIconCategory);
      const icons = currentCategory?.icons || [];
      if (icons.length > 0) {
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];
        const currentColor = ICON_COLORS[iconColor]?.color || ICON_COLORS[0].color;
        const iconValue = `icon:${randomIcon.name}:${currentColor}`;
        lastRandomIconRef.current = iconValue;
        onSelect(iconValue);
      }
    }
  }, [activeTab, activeEmojiCategory, activeIconCategory, iconColor, onSelect]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
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
        const newTab = activeTab === 'emoji' ? 'icons' : 'emoji';
        handleTabChange(newTab);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [handleClose, onPreview, activeTab, handleTabChange]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute z-50 shadow-lg rounded-lg overflow-hidden",
        "border border-[var(--neko-border)] bg-white dark:bg-zinc-900",
        "w-[352px]",
        "select-none"
      )}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-[var(--neko-border)]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => handleTabChange('emoji')}
            className={cn(
              "text-sm font-medium pb-1 border-b-2 transition-colors",
              activeTab === 'emoji'
                ? "text-zinc-900 dark:text-zinc-100 border-zinc-900 dark:border-zinc-100"
                : "text-zinc-400 dark:text-zinc-500 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            Emoji
          </button>
          <button
            onClick={() => handleTabChange('icons')}
            className={cn(
              "text-sm font-medium pb-1 border-b-2 transition-colors",
              activeTab === 'icons'
                ? "text-zinc-900 dark:text-zinc-100 border-zinc-900 dark:border-zinc-100"
                : "text-zinc-400 dark:text-zinc-500 border-transparent hover:text-zinc-600 dark:hover:text-zinc-300"
            )}
          >
            Icons
          </button>
          <button
            onClick={handleRandom}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors pb-1"
          >
            <Shuffle size={16} />
          </button>
        </div>
        {hasIcon && onRemove && (
          <button
            onClick={handleRemove}
            className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
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
      ) : (
        <IconsTab
          recentIcons={recentIcons}
          onSelect={handleIconSelect}
          onPreview={onPreview}
          activeCategory={activeIconCategory}
          onCategoryChange={setActiveIconCategory}
          iconColor={iconColor}
          setIconColor={setIconColor}
          currentIcon={currentIcon}
        />
      )}
    </div>
  );
}
