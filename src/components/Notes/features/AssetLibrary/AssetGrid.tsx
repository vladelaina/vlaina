import { useEffect, useCallback, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { AssetGridProps } from './types';
import { AssetThumbnail } from './components/AssetThumbnail';
import { useAssetHover } from './hooks/useAssetHover';
import { themeAssetGridTokens, themeDomStyleTokens, themeImageBlockStyleTokens } from '@/styles/themeTokens';

const GRID_GAP_PX = themeAssetGridTokens.gapPx;
const GRID_PADDING_PX = themeAssetGridTokens.paddingPx;
const COMPACT_ITEM_SIZE_PX = themeAssetGridTokens.compactItemSizePx;
const REGULAR_ITEM_SIZE_PX = themeAssetGridTokens.regularItemSizePx;
const GRID_MAX_HEIGHT_PX = themeAssetGridTokens.maxHeightPx;

export function AssetGrid({ onSelect, onHover, notesRootPath, currentNotePath, compact, itemSize }: AssetGridProps) {
  const getAssetList = useNotesStore((state) => state.getAssetList);
  const { hoveredFilename, gridRef } = useAssetHover(onHover);
  const [containerWidth, setContainerWidth] = useState(0);
  const widthFrameRef = useRef<number | null>(null);

  const assets = getAssetList();
  const baseItemSize = itemSize ?? (compact ? COMPACT_ITEM_SIZE_PX : REGULAR_ITEM_SIZE_PX);
  const innerWidth = Math.max(0, containerWidth - GRID_PADDING_PX * 2);
  const columnCount = Math.max(
    1,
    Math.floor((innerWidth + GRID_GAP_PX) / (baseItemSize + GRID_GAP_PX)),
  );
  const resolvedItemSize = innerWidth > 0
    ? Math.max(
        themeAssetGridTokens.minResolvedItemSizePx,
        Math.floor((innerWidth - GRID_GAP_PX * (columnCount - 1)) / columnCount),
      )
    : baseItemSize;
  const rowCount = Math.ceil(assets.length / columnCount);
  const totalHeight = rowCount > 0
    ? GRID_PADDING_PX * 2 + rowCount * resolvedItemSize + (rowCount - 1) * GRID_GAP_PX
    : 0;
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => gridRef.current,
    estimateSize: () => resolvedItemSize + GRID_GAP_PX,
    overscan: 1,
  });
  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const commitWidth = () => {
      const nextWidth = grid.clientWidth;
      setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
    };
    const scheduleWidthCommit = () => {
      if (widthFrameRef.current !== null) {
        return;
      }

      widthFrameRef.current = requestAnimationFrame(() => {
        widthFrameRef.current = null;
        commitWidth();
      });
    };

    commitWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(scheduleWidthCommit);
    resizeObserver.observe(grid);

    return () => {
      if (widthFrameRef.current !== null) {
        cancelAnimationFrame(widthFrameRef.current);
        widthFrameRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [gridRef]);

  useEffect(() => {
    virtualizer.measure();
  }, [resolvedItemSize, virtualizer]);

  const handleSelect = useCallback((filename: string) => {
    onSelect(filename);
  }, [onSelect]);

  if (assets.length === 0 || rowCount === 0) {
    return null;
  }

  return (
    <div
      ref={gridRef}
      className={cn('relative overflow-y-auto', compact && 'app-scrollbar')}
      style={{ maxHeight: `${GRID_MAX_HEIGHT_PX}px` }}
    >
      <div
        style={{
          height: `${totalHeight}px`,
          position: themeDomStyleTokens.positionRelative,
          width: themeImageBlockStyleTokens.widthFull,
        }}
      >
        {virtualRows.map((virtualRow) => {
          const start = virtualRow.index * columnCount;
          const rowAssets = assets.slice(start, start + columnCount);
          if (!rowAssets || rowAssets.length === 0) {
            return null;
          }

          return rowAssets.map((asset, columnIndex) => {
            const left = GRID_PADDING_PX + columnIndex * (resolvedItemSize + GRID_GAP_PX);
            const top = GRID_PADDING_PX + virtualRow.start;

            return (
              <div
                key={asset.filename}
                style={{
                  height: `${resolvedItemSize}px`,
                  left: `${left}px`,
                  position: 'absolute',
                  top: `${top}px`,
                  width: `${resolvedItemSize}px`,
                }}
              >
                <AssetThumbnail
                  filename={asset.filename}
                  size={asset.size}
                  notesRootPath={notesRootPath}
                  currentNotePath={currentNotePath}
                  onSelect={() => handleSelect(asset.filename)}
                  isHovered={hoveredFilename === asset.filename}
                  compact={compact}
                  loadPriority={start + columnIndex}
                />
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
