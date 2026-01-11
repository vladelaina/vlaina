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
  MAX_RECENT_EMOJIS,
  EMOJI_CATEGORIES,
} from './constants';
import { ICON_LIST } from './icons';

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  onRemove?: () => void;
  onClose: () => void;
  hasIcon?: boolean;
  currentIcon?: string;
  onIconChange?: (emoji: string) => void;
}

export function IconPicker({
  onSelect,
  onPreview,
  onRemove,
  onClose,
  hasIcon = false,
  currentIcon,
  onIconChange
}: IconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>(loadActiveTab);
  const [recentIcons, setRecentIcons] = useState<string[]>(loadRecentIcons);
  const [skinTone, setSkinTone] = useState(loadSkinTone);

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

  const handleEmojiSelect = useCallback((emoji: string) => {
    lastRandomIconRef.current = null; // Clear random tracking
    const updated = addToRecentIcons(emoji, recentIcons);
    setRecentIcons(updated);
    onSelect(emoji);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handleIconSelect = useCallback((iconName: string, color: string) => {
    lastRandomIconRef.current = null; // Clear random tracking
    const iconValue = `icon:${iconName}:${color}`;
    const updated = addToRecentIcons(iconValue, recentIcons);
    setRecentIcons(updated);
    onSelect(iconValue);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handleRemove = useCallback(() => {
    lastRandomIconRef.current = null;
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  // Add random icon to recent when closing (if user kept it)
  const handleClose = useCallback(() => {
    if (lastRandomIconRef.current) {
      const updated = addToRecentIcons(lastRandomIconRef.current, recentIcons);
      setRecentIcons(updated);
      lastRandomIconRef.current = null;
    }
    onClose();
  }, [recentIcons, onClose]);

  // Random selection based on current tab (don't close picker, don't add to recent yet)
  const handleRandom = useCallback(() => {
    if (activeTab === 'emoji') {
      const allEmojis = EMOJI_CATEGORIES.flatMap(cat => cat.emojis);
      if (allEmojis.length > 0) {
        const randomEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
        lastRandomIconRef.current = randomEmoji.native;
        onSelect(randomEmoji.native);
      }
    } else {
      if (ICON_LIST.length > 0) {
        const randomIcon = ICON_LIST[Math.floor(Math.random() * ICON_LIST.length)];
        const iconValue = `icon:${randomIcon.name}:${randomIcon.color}`;
        lastRandomIconRef.current = iconValue;
        onSelect(iconValue);
      }
    }
  }, [activeTab, onSelect]);

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
          onIconChange={onIconChange}
        />
      ) : (
        <IconsTab
          recentIcons={recentIcons}
          onSelect={handleIconSelect}
          onPreview={onPreview}
        />
      )}
    </div>
  );
}
