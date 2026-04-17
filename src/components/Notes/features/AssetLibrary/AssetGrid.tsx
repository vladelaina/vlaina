import { useEffect, useCallback, useMemo, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { DeletableItem } from '@/components/ui/deletable-item';
import { AssetGridProps } from './types';
import { isBuiltinCover } from '@/lib/assets/builtinCovers';
import { AssetThumbnail } from './components/AssetThumbnail';
import { useAssetHover } from './hooks/useAssetHover';

const GRID_GAP_PX = 8;
const GRID_PADDING_PX = 8;
const COMPACT_ITEM_SIZE_PX = 60;
const REGULAR_ITEM_SIZE_PX = 104;
const GRID_MAX_HEIGHT_PX = 280;

export function AssetGrid({ onSelect, onHover, vaultPath, compact, itemSize, category }: AssetGridProps) {
  const getAssetList = useNotesStore((state) => state.getAssetList);
  const deleteAsset = useNotesStore((state) => state.deleteAsset);
  const loadAssets = useNotesStore((state) => state.loadAssets);
  const { hoveredFilename, gridRef } = useAssetHover(onHover);
  const [containerWidth, setContainerWidth] = useState(0);

  const assets = getAssetList(category);
  const baseItemSize = itemSize ?? (compact ? COMPACT_ITEM_SIZE_PX : REGULAR_ITEM_SIZE_PX);
  const innerWidth = Math.max(0, containerWidth - GRID_PADDING_PX * 2);
  const columnCount = Math.max(
    1,
    Math.floor((innerWidth + GRID_GAP_PX) / (baseItemSize + GRID_GAP_PX)),
  );
  const resolvedItemSize = innerWidth > 0
    ? Math.max(
        48,
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
    overscan: 3,
  });
  const virtualRows = virtualizer.getVirtualItems();

  useEffect(() => {
    if (vaultPath) {
      loadAssets(vaultPath);
    }
  }, [vaultPath, loadAssets]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const commitWidth = () => {
      const nextWidth = grid.clientWidth;
      setContainerWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    commitWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      commitWidth();
    });
    resizeObserver.observe(grid);

    return () => {
      resizeObserver.disconnect();
    };
  }, [gridRef]);

  useEffect(() => {
    virtualizer.measure();
  }, [resolvedItemSize, virtualizer]);

  const handleSelect = useCallback((filename: string) => {
    onSelect(filename);
  }, [onSelect]);

  const rows = useMemo(
    () =>
      Array.from({ length: rowCount }, (_, rowIndex) => {
        const start = rowIndex * columnCount;
        return assets.slice(start, start + columnCount);
      }),
    [assets, columnCount, rowCount],
  );

  if (assets.length === 0 || rowCount === 0) {
    return null;
  }

  return (
    <div
      ref={gridRef}
      className={cn('relative overflow-y-auto', compact && 'vlaina-scrollbar')}
      style={{ maxHeight: `${GRID_MAX_HEIGHT_PX}px` }}
    >
      <div
        style={{
          height: `${totalHeight}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowAssets = rows[virtualRow.index];
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
                <DeletableItem
                  id={asset.filename}
                  onDelete={(id) => deleteAsset(id)}
                  className="relative h-full w-full rounded-lg overflow-hidden"
                  disabled={isBuiltinCover(asset.filename)}
                >
                  <AssetThumbnail
                    filename={asset.filename}
                    size={asset.size}
                    vaultPath={vaultPath}
                    onSelect={() => handleSelect(asset.filename)}
                    isHovered={hoveredFilename === asset.filename}
                    compact={compact}
                  />
                </DeletableItem>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}
