import { useRef, useEffect, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  EMOJI_PER_ROW,
  EMOJI_SIZE,
  ROW_GAP,
  EMOJI_MAP,
  SCROLLBAR_CLASSNAME,
  type EmojiItem,
} from './constants';
import { useI18n } from '@/lib/i18n';
import { themeDomStyleTokens, themeEmojiPickerTokens, themeIconTokens, themeRenderingTokens } from '@/styles/themeTokens';
import { AppIcon } from '@/components/common/AppIcon';

const DEFAULT_EMOJI_CATEGORY_ID = 'people';
const GRID_ICON_SIZE = themeIconTokens.sizeMd;

interface IconRowProps {
  icons: string[];
  imageLoader?: (src: string) => Promise<string>;
  allowLegacyImageScheme?: boolean;
}

const IconRow = memo(
  function IconRow({ icons, imageLoader, allowLegacyImageScheme = false }: IconRowProps) {
    return (
      <div className="px-2 grid grid-cols-9 gap-0.5">
        {icons.map((icon, i) => (
          <button
            key={i}
            data-icon={icon}
            className="w-full aspect-square flex items-center justify-center rounded-md text-xl hover:bg-[var(--vlaina-bg-hover)]"
          >
            <AppIcon
              icon={icon}
              size={GRID_ICON_SIZE}
              imageLoader={imageLoader}
              allowLegacyImageScheme={allowLegacyImageScheme}
            />
          </button>
        ))}
      </div>
    );
  },
  (prev, next) => {
    if (prev.imageLoader !== next.imageLoader) return false;
    if (prev.allowLegacyImageScheme !== next.allowLegacyImageScheme) return false;
    if (prev.icons.length !== next.icons.length) return false;
    for (let i = 0; i < prev.icons.length; i++) {
      if (prev.icons[i] !== next.icons[i]) return false;
    }
    return true;
  }
);

interface VirtualEmojiGridProps {
  emojis: EmojiItem[];
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
  recentIcons: string[];
  categoryId: string;
  categoryName: string;
  imageLoader?: (src: string) => Promise<string>;
  allowLegacyImageScheme?: boolean;
}

export function VirtualEmojiGrid({
  emojis,
  skinTone,
  onSelect,
  onPreview,
  recentIcons,
  categoryId,
  categoryName,
  imageLoader,
  allowLegacyImageScheme = false,
}: VirtualEmojiGridProps) {
  const { t } = useI18n();
  const parentRef = useRef<HTMLDivElement>(null);

  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;

  const emojisWithSkin = useMemo(() => {
    return emojis.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [emojis, skinTone]);

  const recentIconsWithSkin = useMemo(() => {
    return recentIcons.map(icon => {
      const item = EMOJI_MAP.get(icon);
      if (!item) return icon;
      if (skinTone === 0 || !item.skins || item.skins.length <= skinTone) {
        return item.native;
      }
      return item.skins[skinTone]?.native || item.native;
    });
  }, [recentIcons, skinTone]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'icons'; content: string | string[] }[] = [];

    if (recentIconsWithSkin.length > 0) {
      result.push({ type: 'title', content: t('icon.categoryRecent') });
      for (let i = 0; i < recentIconsWithSkin.length; i += EMOJI_PER_ROW) {
        result.push({ type: 'icons', content: recentIconsWithSkin.slice(i, i + EMOJI_PER_ROW) });
      }
    }

    result.push({ type: 'title', content: categoryName });
    for (let i = 0; i < emojisWithSkin.length; i += EMOJI_PER_ROW) {
      result.push({ type: 'icons', content: emojisWithSkin.slice(i, i + EMOJI_PER_ROW) });
    }

    return result;
  }, [emojisWithSkin, recentIconsWithSkin, categoryName, t]);

  const rowSizeGetter = useMemo(() => {
    return (index: number) => rows[index].type === 'title' ? themeEmojiPickerTokens.virtualTitleRowHeightPx : EMOJI_SIZE + ROW_GAP;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: rowSizeGetter,
    overscan: themeEmojiPickerTokens.virtualOverscanRows,
  });

  useEffect(() => {
    if (categoryId === DEFAULT_EMOJI_CATEGORY_ID) {
      virtualizer.scrollToIndex(0, { align: 'start' });
    } else if (recentIconsWithSkin.length > 0) {
      const recentRows = Math.ceil(recentIconsWithSkin.length / EMOJI_PER_ROW) + 1;
      virtualizer.scrollToIndex(recentRows, { align: 'start' });
    } else {
      virtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [categoryId]);

  const lastPreviewRef = useRef<string | null>(null);

  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      const icon = button?.dataset.icon || null;
      if (icon !== lastPreviewRef.current) {
        lastPreviewRef.current = icon;
        onPreviewRef.current?.(icon);
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewRef.current !== null) {
        lastPreviewRef.current = null;
        onPreviewRef.current?.(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon) {
        onSelectRef.current(button.dataset.icon);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <div
      ref={parentRef}
      className={`h-[var(--vlaina-size-280px)] overflow-auto ${SCROLLBAR_CLASSNAME}`}
      style={{ contain: themeRenderingTokens.containStrict, willChange: themeRenderingTokens.scrollPositionWillChange }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: themeDomStyleTokens.sizeFull,
          position: themeDomStyleTokens.positionRelative,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: themeDomStyleTokens.positionAbsolute,
                top: themeDomStyleTokens.numericZero,
                left: themeDomStyleTokens.numericZero,
                width: themeDomStyleTokens.sizeFull,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-2 pt-2 pb-1 text-xs text-[var(--vlaina-text-tertiary)] font-medium">
                  {row.content as string}
                </div>
              ) : (
                <IconRow
                  icons={row.content as string[]}
                  imageLoader={imageLoader}
                  allowLegacyImageScheme={allowLegacyImageScheme}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface VirtualSearchResultsProps {
  results: EmojiItem[];
  skinTone: number;
  onSelect: (emoji: string) => void;
  onPreview?: (emoji: string | null) => void;
}

export function VirtualSearchResults({
  results,
  skinTone,
  onSelect,
  onPreview,
}: VirtualSearchResultsProps) {
  const { t } = useI18n();
  const parentRef = useRef<HTMLDivElement>(null);
  const lastPreviewRef = useRef<string | null>(null);

  const onPreviewRef = useRef(onPreview);
  const onSelectRef = useRef(onSelect);
  onPreviewRef.current = onPreview;
  onSelectRef.current = onSelect;

  const emojisWithSkin = useMemo(() => {
    return results.map(emoji => {
      if (skinTone === 0 || !emoji.skins || emoji.skins.length <= skinTone) {
        return emoji.native;
      }
      return emoji.skins[skinTone]?.native || emoji.native;
    });
  }, [results, skinTone]);

  const rows = useMemo(() => {
    const result: { type: 'title' | 'icons'; content: string | string[] }[] = [];
    result.push({ type: 'title', content: t('icon.searchResults', { count: results.length }) });
    for (let i = 0; i < emojisWithSkin.length; i += EMOJI_PER_ROW) {
      result.push({ type: 'icons', content: emojisWithSkin.slice(i, i + EMOJI_PER_ROW) });
    }
    return result;
  }, [emojisWithSkin, results.length, t]);

  const rowSizeGetter = useMemo(() => {
    return (index: number) => rows[index].type === 'title' ? themeEmojiPickerTokens.virtualTitleRowHeightPx : EMOJI_SIZE + ROW_GAP;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: rowSizeGetter,
    overscan: themeEmojiPickerTokens.virtualOverscanRows,
  });

  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      const icon = button?.dataset.icon || null;
      if (icon !== lastPreviewRef.current) {
        lastPreviewRef.current = icon;
        onPreviewRef.current?.(icon);
      }
    };

    const handleMouseLeave = () => {
      if (lastPreviewRef.current !== null) {
        lastPreviewRef.current = null;
        onPreviewRef.current?.(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-icon]') as HTMLElement;
      if (button?.dataset.icon) {
        onSelectRef.current(button.dataset.icon);
      }
    };

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
    };
  }, []);

  if (results.length === 0) {
    return (
      <div className="h-[var(--vlaina-size-280px)] flex items-center justify-center">
        <div className="text-[var(--vlaina-text-tertiary)] text-sm">{t('icon.noEmojiFound')}</div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`h-[var(--vlaina-size-280px)] overflow-auto ${SCROLLBAR_CLASSNAME}`}
      style={{ contain: themeRenderingTokens.containStrict, willChange: themeRenderingTokens.scrollPositionWillChange }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: themeDomStyleTokens.sizeFull,
          position: themeDomStyleTokens.positionRelative,
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: themeDomStyleTokens.positionAbsolute,
                top: themeDomStyleTokens.numericZero,
                left: themeDomStyleTokens.numericZero,
                width: themeDomStyleTokens.sizeFull,
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'title' ? (
                <div className="px-2 pt-2 pb-1 text-xs text-[var(--vlaina-text-tertiary)] font-medium">
                  {row.content as string}
                </div>
              ) : (
                <IconRow icons={row.content as string[]} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
