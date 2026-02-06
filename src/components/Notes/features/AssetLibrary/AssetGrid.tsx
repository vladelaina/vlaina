import { useEffect, useCallback } from 'react';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { cn } from '@/lib/utils';
import { DeletableItem } from '@/components/ui/deletable-item';
import { AssetGridProps } from './types';
import { isBuiltinCover } from '@/lib/assets/builtinCovers';
import { AssetThumbnail } from './components/AssetThumbnail';
import { useAssetHover } from './hooks/useAssetHover';

export function AssetGrid({ onSelect, onHover, vaultPath, compact, itemSize, category }: AssetGridProps) {
  const { getAssetList, deleteAsset, loadAssets } = useNotesStore();
  const { hoveredFilename, gridRef } = useAssetHover(onHover);

  const assets = getAssetList(category);

  useEffect(() => {
    if (vaultPath) {
      loadAssets(vaultPath);
    }
  }, [vaultPath, loadAssets]);

  const handleSelect = useCallback((filename: string) => {
    onSelect(filename);
  }, [onSelect]);

  if (assets.length === 0) {
    return null;
  }

  const gridStyle = itemSize
    ? { gridTemplateColumns: `repeat(auto-fill, minmax(${itemSize}px, 1fr))` }
    : undefined;

  return (
    <div
      ref={gridRef}
      className={cn("grid gap-2 p-2", !itemSize && (compact ? "grid-cols-5" : "grid-cols-3"))}
      style={gridStyle}
    >
      {assets.map((asset) => (
        <DeletableItem
          key={asset.filename}
          id={asset.filename}
          onDelete={(id) => deleteAsset(id)}
          className="relative aspect-square rounded-lg overflow-hidden"
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
      ))}
    </div>
  );
}
