import { memo, useMemo, useState, useEffect } from 'react';
import { icons } from '@/components/ui/icons/registry';
import { ICON_SIZES, IconSize } from '@/components/ui/icons/sizes';
import { cn } from '@/lib/utils';
import { ImageEdgeMask } from '@/components/common/ImageEdgeMask';
import { resolveEmojiForSkinTone } from './randomEmoji';

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
  rounding,
  maskColor,
}: {
  src: string;
  size?: number | string | IconSize;
  className?: string;
  rounding?: string;
  maskColor?: string | null;
}) {
  if (!src) return null;
  const resolvedSize = resolveSize(size);
  const radiusClassName = rounding || 'rounded-sm';

  if (!maskColor) {
    return (
      <img
        src={src}
        className={cn('object-cover select-none pointer-events-none', radiusClassName, className)}
        style={{ width: resolvedSize, height: resolvedSize, display: 'inline-block' }}
        draggable={false}
        alt="icon"
      />
    );
  }

  return (
    <span
      className={cn('relative inline-flex overflow-hidden align-middle', radiusClassName, className)}
      style={{ width: resolvedSize, height: resolvedSize }}
    >
      <img
        src={src}
        className={cn('h-full w-full object-cover select-none pointer-events-none', radiusClassName)}
        style={{ display: 'inline-block' }}
        draggable={false}
        alt="icon"
      />
      <ImageEdgeMask color={maskColor} rounding={radiusClassName} />
    </span>
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
  const [displayEmoji, setDisplayEmoji] = useState(emoji);

  useEffect(() => {
    let active = true;
    if (previewTone === null || previewTone === undefined) {
      setDisplayEmoji(emoji);
      return () => {
        active = false;
      };
    }

    void (async () => {
      const resolved = await resolveEmojiForSkinTone(emoji, previewTone);
      if (active) {
        setDisplayEmoji(resolved);
      }
    })();

    return () => {
      active = false;
    };
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
    const load = async () => {
      if (icon && icon.startsWith('img:')) {
        if (imageLoader) {
          try {
            const url = await imageLoader(icon);
            if (active) setImgSrc(url);
          } catch {
            if (active) setImgSrc(null);
          }
        } else {
          if (active) setImgSrc(icon.substring(4));
        }
      } else {
        setImgSrc(null);
      }
    };
    load();
    return () => { active = false; };
  }, [icon, imageLoader]);

  if (!icon) return null;

  if (icon.startsWith('img:')) {
    return imgSrc ? (
      <ImageIconRenderer
        src={imgSrc}
        size={size}
        className={className}
        rounding={rounding}
        maskColor={previewColor || color || null}
      />
    ) : (
      <div style={{ width: resolvedSize, height: resolvedSize }} className={className} />
    );
  }

  if (icon.startsWith('icon:') || icon in icons) {
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
