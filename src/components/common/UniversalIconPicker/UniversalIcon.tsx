import { memo, useMemo, useState, useEffect } from 'react';
import { icons } from '@/components/ui/icons/registry';
import { ICON_SIZES, IconSize } from '@/components/ui/icons/sizes';
import { cn } from '@/lib/utils';
import { ICON_MAP as ICON_ITEM_MAP, EMOJI_MAP } from './constants';

export interface UniversalIconProps {
  icon: string;
  size?: number | string | IconSize;
  className?: string;
  rounding?: string;
  color?: string;
  previewColor?: string | null;
  previewTone?: number | null;
  imageLoader?: (src: string) => Promise<string>;
}

const resolveSize = (size?: number | string | IconSize) => {
  if (typeof size === 'string' && size in ICON_SIZES) {
    return ICON_SIZES[size as IconSize];
  }
  return size;
};

const ImageIconRenderer = memo(function ImageIconRenderer({
  src,
  size,
  className,
  rounding
}: {
  src: string;
  size?: number | string | IconSize;
  className?: string;
  rounding?: string;
}) {
  if (!src) return null;
  const resolvedSize = resolveSize(size);
  return (
    <img
      src={src}
      className={cn("object-cover select-none pointer-events-none", rounding || "rounded-sm", className)}
      style={{ width: resolvedSize, height: resolvedSize, display: 'inline-block' }}
      draggable={false}
      alt="icon"
    />
  );
});

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
  size?: number | string | IconSize;
  className?: string;
  previewColor?: string | null;
}) {
  const color = previewColor || forcedColor || originalColor;
  
  const IconComponent = useMemo(() => {
    // 1. Try Registry First (Semantic Names)
    if (iconName in icons) {
      return icons[iconName as keyof typeof icons];
    }

    return null; 
  }, [iconName]);

  const resolvedSize = resolveSize(size);
  const isCSSVariable = typeof resolvedSize === 'string' && resolvedSize.startsWith('var(');

  if (!IconComponent) return null;

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: resolvedSize,
        height: resolvedSize,
        lineHeight: 1,
      }}
    >
      <IconComponent
        size={isCSSVariable ? '100%' : resolvedSize}
        style={{
          color,
          ...(isCSSVariable ? { width: '100%', height: '100%' } : {})
        }}
      />
    </span>
  );
});

const EmojiIconRenderer = memo(function EmojiIconRenderer({
  emoji,
  size,
  className,
  previewTone,
}: {
  emoji: string;
  size?: number | string | IconSize;
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

  const resolvedSize = resolveSize(size);

  return (
    <span
      className={className}
      style={{ fontSize: resolvedSize, lineHeight: 1, display: 'inline-block', userSelect: 'none' }}
    >
      {displayEmoji}
    </span>
  );
});

export function UniversalIcon({ 
  icon, 
  size = 'md', 
  className, 
  rounding,
  color,
  previewColor,
  previewTone,
  imageLoader
}: UniversalIconProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const resolvedSize = resolveSize(size);

  useEffect(() => {
    let active = true;
    if (icon && icon.startsWith('img:')) {
      if (imageLoader) {
        imageLoader(icon).then(url => { if (active) setImgSrc(url); }).catch(() => { if (active) setImgSrc(null); });
      } else {
        if (active) setImgSrc(icon.substring(4));
      }
    } else {
      setImgSrc(null);
    }
    return () => { active = false; };
  }, [icon, imageLoader]);

  if (!icon) return null;

  if (icon.startsWith('img:')) {
    return imgSrc ? <ImageIconRenderer src={imgSrc} size={size} className={className} rounding={rounding} /> : <div style={{ width: resolvedSize, height: resolvedSize }} className={className} />;
  }

  if (icon.startsWith('icon:') || ICON_ITEM_MAP.has(icon) || icon in icons) {
    let iconName = icon;
    let originalColor = '#6b7280';
    if (icon.startsWith('icon:')) {
      const parts = icon.split(':');
      iconName = parts[1];
      originalColor = parts[2] || '#6b7280';
    }
    return <IconIconRenderer iconName={iconName} originalColor={originalColor} forcedColor={color} size={size} className={className} previewColor={previewColor} />;
  }

  return <EmojiIconRenderer emoji={icon} size={size} className={className} previewTone={previewTone} />;
}
