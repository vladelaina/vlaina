import { memo, useMemo, useState, useEffect } from 'react';
import { icons } from '@/components/ui/icons/registry';
import { ICON_SIZES, IconSize } from '@/components/ui/icons/sizes';
import { cn } from '@/lib/utils';
import { ImageEdgeMask } from '@/components/common/ImageEdgeMask';
import { resolveEmojiForSkinTone } from './randomEmoji';
import { themeColorTokens, themeDomStyleTokens, themeRenderingTokens, themeTypographyTokens } from '@/styles/themeTokens';

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

const defaultImageSrcCache = new Map<string, string>();
const loaderImageSrcCaches = new WeakMap<(src: string) => Promise<string>, Map<string, string>>();

const hasIconImageScheme = (value: string) => /^img:/i.test(value);
const hasIconSymbolScheme = (value: string) => /^icon:/i.test(value);

function getImageSrcCache(imageLoader?: (src: string) => Promise<string>) {
  if (!imageLoader) return defaultImageSrcCache;

  let cache = loaderImageSrcCaches.get(imageLoader);
  if (!cache) {
    cache = new Map<string, string>();
    loaderImageSrcCaches.set(imageLoader, cache);
  }
  return cache;
}

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
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    setHasLoadError(false);
  }, [src]);

  if (!src) return null;
  const resolvedSize = resolveSize(size);
  const radiusClassName = rounding || 'rounded-sm';

  if (hasLoadError) {
    return <span className={className} style={{ width: resolvedSize, height: resolvedSize, display: themeDomStyleTokens.displayInlineBlock }} />;
  }

  if (!maskColor) {
    return (
      <img
        src={src}
        className={cn('object-cover select-none pointer-events-none', radiusClassName, className)}
        style={{ width: resolvedSize, height: resolvedSize, display: themeDomStyleTokens.displayInlineBlock }}
        draggable={false}
        alt="icon"
        onError={() => setHasLoadError(true)}
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
        style={{ display: themeDomStyleTokens.displayInlineBlock }}
        draggable={false}
        alt="icon"
        onError={() => setHasLoadError(true)}
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
        display: themeDomStyleTokens.displayInlineFlex,
        alignItems: themeDomStyleTokens.alignCenter,
        justifyContent: themeDomStyleTokens.justifyCenter,
        width: resolvedSize,
        height: resolvedSize,
        lineHeight: themeTypographyTokens.iconLineHeight,
      }}
    >
      <IconComponent
        size={isCSSVariable ? themeDomStyleTokens.sizeFull : resolvedSize}
        style={{
          color,
          ...(isCSSVariable ? { width: themeDomStyleTokens.sizeFull, height: themeDomStyleTokens.sizeFull } : {})
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
      style={{
        fontSize: resolvedSize,
        lineHeight: themeTypographyTokens.iconLineHeight,
        display: themeDomStyleTokens.displayInlineBlock,
        userSelect: themeRenderingTokens.userSelectNone,
      }}
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
  const imageSrcCache = getImageSrcCache(imageLoader);
  const [loadedImage, setLoadedImage] = useState<{ icon: string; src: string | null }>(() => {
    if (!hasIconImageScheme(icon)) {
      return { icon, src: null };
    }
    return { icon, src: imageSrcCache.get(icon) ?? null };
  });
  const resolvedSize = resolveSize(size);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (icon && hasIconImageScheme(icon)) {
        const cachedSrc = imageSrcCache.get(icon);
        if (cachedSrc) {
          setLoadedImage({ icon, src: cachedSrc });
          return;
        }

        if (imageLoader) {
          try {
            const url = await imageLoader(icon);
            if (url) imageSrcCache.set(icon, url);
            if (active) setLoadedImage({ icon, src: url || null });
          } catch {
            if (active) setLoadedImage({ icon, src: null });
          }
        } else {
          const url = icon.substring(4);
          if (url) imageSrcCache.set(icon, url);
          if (active) setLoadedImage({ icon, src: url || null });
        }
      } else {
        setLoadedImage({ icon, src: null });
      }
    };
    load();
    return () => { active = false; };
  }, [icon, imageLoader, imageSrcCache]);

  if (!icon) return null;

  if (hasIconImageScheme(icon)) {
    const imgSrc = loadedImage.icon === icon
      ? loadedImage.src
      : imageSrcCache.get(icon) ?? null;

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

  if (hasIconSymbolScheme(icon) || icon in icons) {
    let iconName = icon;
    let originalColor: string = themeColorTokens.iconDefault;
    if (hasIconSymbolScheme(icon)) {
      const parts = icon.split(':');
      iconName = parts[1];
      originalColor = parts[2] || themeColorTokens.iconDefault;
    }
    return <IconIconRenderer iconName={iconName} originalColor={originalColor} forcedColor={color} size={size} className={className} previewColor={previewColor} />;
  }

  return <EmojiIconRenderer emoji={icon} size={size} className={className} previewTone={previewTone} />;
}
