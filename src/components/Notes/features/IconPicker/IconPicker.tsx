/**
 * IconPicker - Emoji and Icon picker with virtual scrolling
 * 
 * Refactored into smaller modules:
 * - constants.ts: Constants, types, and utilities
 * - VirtualEmojiGrid.tsx: Virtualized emoji grid components
 * - VirtualIconGrid.tsx: Virtualized icon grid component
 * - EmojiTab.tsx: Emoji tab with search and skin tone
 * - IconsTab.tsx: Icons tab with category navigation
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
} from './constants';

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

  const recentEmojis = useMemo(() => 
    recentIcons.filter(i => !i.startsWith('icon:')).slice(0, MAX_RECENT_EMOJIS),
    [recentIcons]
  );

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    saveActiveTab(tab);
  }, []);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const updated = addToRecentIcons(emoji, recentIcons);
    setRecentIcons(updated);
    onSelect(emoji);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handleIconSelect = useCallback((iconName: string, color: string) => {
    const iconValue = `icon:${iconName}:${color}`;
    const updated = addToRecentIcons(iconValue, recentIcons);
    setRecentIcons(updated);
    onSelect(iconValue);
    onClose();
  }, [recentIcons, onSelect, onClose]);

  const handleRemove = useCallback(() => {
    onRemove?.();
    onClose();
  }, [onRemove, onClose]);

  // Click outside to close
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onPreview?.(null);
        onClose();
      }
      if (e.key === 'Tab' && e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        const newTab = activeTab === 'emoji' ? 'icons' : 'emoji';
        handleTabChange(newTab);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, onPreview, activeTab, handleTabChange]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute z-50 shadow-lg rounded-lg overflow-hidden",
        "border border-[var(--neko-border)] bg-white dark:bg-zinc-900",
        "w-[352px]"
      )}
    >
      {/* Tab Header */}
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

      {/* Tab Content */}
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
