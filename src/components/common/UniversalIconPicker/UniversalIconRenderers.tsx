import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ImageEdgeMask } from '@/components/common/ImageEdgeMask';
import { icons } from '@/components/ui/icons/registry';
import { ICON_SIZES, type IconSize } from '@/components/ui/icons/sizes';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { themeDomStyleTokens, themeRenderingTokens, themeTypographyTokens } from '@/styles/themeTokens';
import { resolveEmojiForSkinTone } from './randomEmoji';

export const resolveIconSize = (size?: number | string | IconSize) => {
  if (typeof size === 'string' && size in ICON_SIZES) {
    return ICON_SIZES[size as IconSize];
  }
  return size;
};

export const ImageIconRenderer = memo(function ImageIconRenderer({
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
  const { t } = useI18n();
  const [hasLoadError, setHasLoadError] = useState(false);
  const previousSrcRef = useRef(src);

  useEffect(() => {
    if (previousSrcRef.current === src) {
      return;
    }
    previousSrcRef.current = src;
    setHasLoadError(false);
  }, [src]);

  if (!src) return null;
  const resolvedSize = resolveIconSize(size);
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
        alt={t('common.icon')}
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
        alt={t('common.icon')}
        onError={() => setHasLoadError(true)}
      />
      <ImageEdgeMask color={maskColor} rounding={radiusClassName} />
    </span>
  );
});

export const IconIconRenderer = memo(function IconIconRenderer({
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

  const resolvedSize = resolveIconSize(size);
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

export const EmojiIconRenderer = memo(function EmojiIconRenderer({
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

  const resolvedSize = resolveIconSize(size);

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
