import { useState, useEffect } from 'react';
import { icons } from '@/components/ui/icons/registry';
import type { IconSize } from '@/components/ui/icons/sizes';
import { themeColorTokens } from '@/styles/themeTokens';
import {
  hasIconImageScheme,
  isEmojiIconValue,
  isIconImageValue,
  parseIconSymbolValue,
} from './iconImageValue';
import {
  EmojiIconRenderer,
  IconIconRenderer,
  ImageIconRenderer,
  resolveIconSize,
} from './UniversalIconRenderers';
import { useImageCacheGeneration } from '@/hooks/useImageCacheGeneration';

export interface UniversalIconProps {
  icon: string;
  size?: number | string | IconSize;
  className?: string;
  rounding?: string;
  color?: string;
  previewColor?: string | null;
  previewTone?: number | null;
  imageLoader?: (src: string) => Promise<string>;
  allowLegacyImageScheme?: boolean;
}

const defaultImageSrcCache = new Map<string, string>();
const loaderImageSrcCaches = new WeakMap<(src: string) => Promise<string>, Map<string, string>>();
const MAX_IMAGE_SRC_CACHE_ENTRIES = 512;

function getImageSrcCache(imageLoader?: (src: string) => Promise<string>) {
  if (!imageLoader) return defaultImageSrcCache;

  let cache = loaderImageSrcCaches.get(imageLoader);
  if (!cache) {
    cache = new Map<string, string>();
    loaderImageSrcCaches.set(imageLoader, cache);
  }
  return cache;
}

function getCachedImageSrc(cache: Map<string, string>, icon: string): string | null {
  const cached = cache.get(icon);
  if (!cached) {
    return null;
  }
  cache.delete(icon);
  cache.set(icon, cached);
  return cached;
}

function setCachedImageSrc(cache: Map<string, string>, icon: string, src: string): void {
  cache.delete(icon);
  cache.set(icon, src);

  while (cache.size > MAX_IMAGE_SRC_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    cache.delete(oldestKey);
  }
}

function isRenderableImageIcon(icon: string, allowLegacyImageScheme?: boolean): boolean {
  return isIconImageValue(icon) || (!!allowLegacyImageScheme && hasIconImageScheme(icon));
}

export function UniversalIcon({ 
  icon, 
  size = 'md', 
  className, 
  rounding,
  color,
  previewColor,
  previewTone,
  imageLoader,
  allowLegacyImageScheme,
}: UniversalIconProps) {
  const imageCacheGeneration = useImageCacheGeneration();
  const imageSrcCache = getImageSrcCache(imageLoader);
  const imageCacheKey = `${imageCacheGeneration}\0${icon}`;
  const [loadedImage, setLoadedImage] = useState<{
    icon: string;
    imageCacheGeneration: number;
    src: string | null;
  }>(() => {
    if (!isRenderableImageIcon(icon, allowLegacyImageScheme)) {
      return { icon, imageCacheGeneration, src: null };
    }
    return {
      icon,
      imageCacheGeneration,
      src: getCachedImageSrc(imageSrcCache, imageCacheKey),
    };
  });
  const resolvedSize = resolveIconSize(size);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (icon && isRenderableImageIcon(icon, allowLegacyImageScheme)) {
        const cachedSrc = getCachedImageSrc(imageSrcCache, imageCacheKey);
        if (cachedSrc) {
          setLoadedImage({ icon, imageCacheGeneration, src: cachedSrc });
          return;
        }

        if (imageLoader) {
          try {
            const url = await imageLoader(icon);
            if (url) setCachedImageSrc(imageSrcCache, imageCacheKey, url);
            if (active) setLoadedImage({ icon, imageCacheGeneration, src: url || null });
          } catch {
            if (active) setLoadedImage({ icon, imageCacheGeneration, src: null });
          }
        } else {
          const url = hasIconImageScheme(icon) ? icon.substring(4) : icon;
          if (url) setCachedImageSrc(imageSrcCache, imageCacheKey, url);
          if (active) setLoadedImage({ icon, imageCacheGeneration, src: url || null });
        }
      } else {
        setLoadedImage({ icon, imageCacheGeneration, src: null });
      }
    };
    load();
    return () => { active = false; };
  }, [allowLegacyImageScheme, icon, imageCacheGeneration, imageCacheKey, imageLoader, imageSrcCache]);

  if (!icon) return null;

  if (isRenderableImageIcon(icon, allowLegacyImageScheme)) {
    const imgSrc = loadedImage.icon === icon && loadedImage.imageCacheGeneration === imageCacheGeneration
      ? loadedImage.src
      : getCachedImageSrc(imageSrcCache, imageCacheKey);

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

  const symbolIcon = parseIconSymbolValue(icon);
  if (symbolIcon || icon in icons) {
    const iconName = symbolIcon?.name ?? icon;
    const originalColor = symbolIcon?.color || themeColorTokens.iconDefault;
    return <IconIconRenderer iconName={iconName} originalColor={originalColor} forcedColor={color} size={size} className={className} previewColor={previewColor} />;
  }

  if (!isEmojiIconValue(icon)) {
    return null;
  }

  return <EmojiIconRenderer emoji={icon} size={size} className={className} previewTone={previewTone} />;
}
