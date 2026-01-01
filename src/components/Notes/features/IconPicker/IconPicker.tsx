/**
 * IconPicker - Emoji picker for document icons
 * 
 * Similar to AFFiNE's "Add icon" feature
 */

import { useRef, useEffect } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { cn } from '@/lib/utils';

interface IconPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function IconPicker({ onSelect, onClose }: IconPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleEmojiSelect = (emoji: { native: string }) => {
    onSelect(emoji.native);
    onClose();
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "absolute z-50 shadow-lg rounded-lg overflow-hidden",
        "border border-[var(--neko-border)]"
      )}
    >
      <Picker
        data={data}
        onEmojiSelect={handleEmojiSelect}
        theme="light"
        locale="zh"
        previewPosition="none"
        skinTonePosition="none"
        navPosition="bottom"
        perLine={8}
        emojiSize={24}
        emojiButtonSize={32}
        maxFrequentRows={2}
      />
    </div>
  );
}
