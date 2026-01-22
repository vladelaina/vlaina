/**
 * UniversalIcon - Renders either an emoji, a lucide icon, or a custom image
 * Performance optimized: uses memo and shallow comparison
 */

import { memo, useMemo, useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ICON_MAP as ICON_ITEM_MAP, EMOJI_MAP } from './constants';

export interface UniversalIconProps {
  icon: string;
  size?: number | string;
  className?: string;
  rounding?: string;
  
  // Force override color (e.g. for task priority)
  color?: string;

  // Preview states (passed from parent/context)
  previewColor?: string | null;
  previewTone?: number | null;
  
  // Optional image loader for custom protocols (e.g. "img:...")
  imageLoader?: (src: string) => Promise<string>;
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
  if (!src) return null;
  
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
const IconIconRenderer = memo(function IconIconRenderer({
  iconName,
  originalColor,
  forcedColor,
  size,
  className,
  previewColor,
}: {
  iconName: string;
  originalColor: string;
  forcedColor?: string;
  size?: number | string;
  className?: string;
  previewColor?: string | null;
}) {
  const color = previewColor || forcedColor || originalColor;
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
      <IconComponent
        size={isCSSVariable ? '100%' : size}
        style={{
          color,
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
  previewTone?: number | null;
}) {
  const displayEmoji = useMemo(() => {
    if (previewTone === null || previewTone === undefined) return emoji;
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

export function UniversalIcon({ 
  icon, 
  size = 16, 
  className, 
  rounding,
  color,
  previewColor,
  previewTone,
  imageLoader
}: UniversalIconProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (icon && icon.startsWith('img:')) {
      if (imageLoader) {
        imageLoader(icon)
          .then(url => {
            if (active) setImgSrc(url);
          })
          .catch(err => {
            console.error('Failed to load icon image', err);
            if (active) setImgSrc(null);
          });
      } else {
        // Fallback: assume the part after "img:" is a valid URL if no loader provided
        if (active) setImgSrc(icon.substring(4));
      }
    } else {
      setImgSrc(null);
    }
    return () => { active = false; };
  }, [icon, imageLoader]);

  if (!icon) return null;

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

  // Handle Vector Icons (Standard format or Legacy plain name)
  if (icon.startsWith('icon:') || ICON_ITEM_MAP.has(icon)) {
    let iconName = icon;
    let originalColor = '#6b7280';

    if (icon.startsWith('icon:')) {
      const parts = icon.split(':');
      iconName = parts[1];
      originalColor = parts[2] || '#6b7280';
    }

    return (
      <IconIconRenderer
        iconName={iconName}
        originalColor={originalColor}
        forcedColor={color}
        size={size}
        className={className}
        previewColor={previewColor}
      />
    );
  }

  // Handle Emojis
  return (
    <EmojiIconRenderer
      emoji={icon}
      size={size}
      className={className}
      previewTone={previewTone}
    />
  );
}
