import { useRef, useEffect, useMemo } from 'react';
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
import { themeDomStyleTokens, themeEmojiPickerTokens, themeRenderingTokens } from '@/styles/themeTokens';
import { IconRow } from './IconRow';
import { useVirtualEmojiGridInteractions } from './useVirtualEmojiGridInteractions';

const DEFAULT_EMOJI_CATEGORY_ID = 'people';

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
  useVirtualEmojiGridInteractions(parentRef, onSelect, onPreview);

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
  useVirtualEmojiGridInteractions(parentRef, onSelect, onPreview);

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
