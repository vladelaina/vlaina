/**
 * NoteIcon - Renders either an emoji or a custom icon
 * Performance optimized: uses memo and shallow comparison
 */

import { memo, useMemo, useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { useUIStore } from '@/stores/uiSlice';
import { useNotesStore } from '@/stores/useNotesStore';
import { loadImageAsBlob } from '@/lib/assets/imageLoader';
import { buildFullAssetPath } from '@/lib/assets/pathUtils';
import { cn } from '@/lib/utils';
import { ICON_MAP as ICON_ITEM_MAP, EMOJI_MAP } from './constants';

interface NoteIconProps {
  icon: string;
  size?: number | string;
  className?: string;
  rounding?: string;
}

// Custom Image renderer component
const ImageIconRenderer = memo(function ImageIconRenderer({
  src,
  size,
  className,
  rounding
}: {
  src: string;
  size?: number | string;
  className?: string;
  rounding?: string;
}) {
  return (
    <img
      src={src}
      className={cn("object-cover select-none pointer-events-none", rounding || "rounded-sm", className)}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
      }}
      draggable={false}
      alt="icon"
    />
  );
});

// Icon renderer component
// NOTE: Lucide icons don't accept CSS variables for size (SVG attributes don't support them).
// We use a container with CSS variable sizing and let the icon fill 100%.
const IconIconRenderer = memo(function IconIconRenderer({
  iconName,
  originalColor,
  size,
  className,
  previewColor,
}: {
  iconName: string;
  originalColor: string;
  size?: number | string;
  className?: string;
  previewColor: string | null;
}) {
  const color = previewColor || originalColor;
  const iconItem = ICON_ITEM_MAP.get(iconName);
  const IconComponent = iconItem?.icon || FileText;

  // Check if size is a CSS variable string
  const isCSSVariable = typeof size === 'string' && size.startsWith('var(');

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        lineHeight: 1,
      }}
    >
      {/* 
        If size is a CSS variable, we can't pass it to Lucide.
        Instead, make the icon fill the container.
      */}
      <IconComponent
        size={isCSSVariable ? '100%' : size}
        style={{
          color,
          // Ensure the icon fills the container when using CSS vars
          ...(isCSSVariable ? { width: '100%', height: '100%' } : {})
        }}
      />
    </span>
  );
});

// Emoji renderer component
const EmojiIconRenderer = memo(function EmojiIconRenderer({
  emoji,
  size,
  className,
  previewTone,
}: {
  emoji: string;
  size?: number | string;
  className?: string;
  previewTone: number | null;
}) {
  const displayEmoji = useMemo(() => {
    if (previewTone === null) return emoji;
    const item = EMOJI_MAP.get(emoji);
    if (item && item.skins && item.skins.length > previewTone) {
      return previewTone === 0 ? item.native : (item.skins[previewTone]?.native || item.native);
    }
    return emoji;
  }, [emoji, previewTone]);

  return (
    <span
      className={className}
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        userSelect: 'none',
      }}
    >
      {displayEmoji}
    </span>
  );
});

// Outer component subscribes to store, only re-renders when preview state changes
export function NoteIcon({ icon, size = 16, className, rounding }: NoteIconProps) {
  const previewIconColor = useUIStore(s => s.notesPreviewIconColor);
  const previewSkinTone = useUIStore(s => s.notesPreviewSkinTone);
  const vaultPath = useNotesStore(s => s.notesPath);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (icon.startsWith('img:') && vaultPath) {
      const relativePath = icon.substring(4);
      const fullPath = buildFullAssetPath(vaultPath, relativePath);

      loadImageAsBlob(fullPath)
        .then(url => {
          if (active) setImgSrc(url);
        })
        .catch(err => {
          console.error('Failed to load icon image', err);
          if (active) setImgSrc(null);
        });
    } else {
      setImgSrc(null);
    }
    return () => { active = false; };
  }, [icon, vaultPath]);

  // Handle Image Icons
  if (icon.startsWith('img:')) {
    if (!imgSrc) {
      // Placeholder or null while loading
      return <div style={{ width: size, height: size }} className={className} />;
    }
    return (
      <ImageIconRenderer
        src={imgSrc}
        size={size}
        className={className}
        rounding={rounding}
      />
    );
  }

  // Handle Vector Icons
  if (icon.startsWith('icon:')) {
    const parts = icon.split(':');
    const iconName = parts[1];
    const originalColor = parts[2] || '#6b7280';

    return (
      <IconIconRenderer
        iconName={iconName}
        originalColor={originalColor}
        size={size}
        className={className}
        previewColor={previewIconColor}
      />
    );
  }

  // Handle Emojis
  return (
    <EmojiIconRenderer
      emoji={icon}
      size={size}
      className={className}
      previewTone={previewSkinTone}
    />
  );
}
