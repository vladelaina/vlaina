import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../../../AssetLibrary';
import { CoverRenderer } from './CoverRenderer';
import type { CoverRendererProps } from './coverRenderer.types';

interface CoverImageShellProps {
  url: string | null;
  readOnly: boolean;
  vaultPath: string;
  showPicker: boolean;
  previewSrc: string | null;
  isError: boolean;
  displaySrc: string;
  coverHeight: number;
  positionX: number;
  positionY: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onSelectCover: (assetPath: string) => void;
  onPreview: (assetPath: string | null) => void;
  onRemoveCover: () => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onResetHeight: () => void;
  rendererProps: Omit<CoverRendererProps, 'displaySrc' | 'positionX' | 'positionY'>;
}

export function CoverImageShell({
  url,
  readOnly,
  vaultPath,
  showPicker,
  previewSrc,
  isError,
  displaySrc,
  coverHeight,
  positionX,
  positionY,
  containerRef,
  onOpenPicker,
  onClosePicker,
  onSelectCover,
  onPreview,
  onRemoveCover,
  onResizeMouseDown,
  onResetHeight,
  rendererProps,
}: CoverImageShellProps) {
  if (!url && !showPicker && !previewSrc) {
    return null;
  }

  if (!url) {
    return (
      <div className="relative w-full">
        {previewSrc && (
          <div className="relative w-full h-[200px] shrink-0 overflow-hidden">
            <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <CoverPicker
          isOpen={showPicker}
          onClose={onClosePicker}
          onSelect={onSelectCover}
          onPreview={onPreview}
          vaultPath={vaultPath}
        />
      </div>
    );
  }

  return (
    <div
      className={cn('relative w-full bg-muted/20 shrink-0 select-none overflow-hidden group')}
      style={{ height: coverHeight }}
      ref={containerRef}
    >
      <CoverRenderer
        {...rendererProps}
        displaySrc={displaySrc}
        positionX={positionX}
        positionY={positionY}
      />

      {isError && (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground z-10',
            !readOnly && 'cursor-pointer hover:bg-muted/30 transition-colors'
          )}
          onMouseDown={() => !readOnly && onOpenPicker()}
        >
          <Icon name="file.brokenImage" className="w-8 h-8 mb-2 opacity-50" />
          <span className="text-xs font-medium opacity-70">Image failed to load</span>
          {!readOnly && <span className="text-[10px] opacity-50 mt-1">Click to replace</span>}
        </div>
      )}

      {!displaySrc && !isError && (
        <div
          className="absolute inset-0 flex items-center justify-center text-muted-foreground cursor-pointer z-10"
          onMouseDown={() => !readOnly && onOpenPicker()}
        >
          {!readOnly && <span className="text-xs">Click to change cover</span>}
        </div>
      )}

      {readOnly && <div className="absolute inset-0 z-20" />}

      {!readOnly && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-40 opacity-0 hover:opacity-100 transition-opacity"
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResetHeight}
        />
      )}

      <CoverPicker
        isOpen={showPicker}
        onClose={onClosePicker}
        onSelect={onSelectCover}
        onRemove={url ? onRemoveCover : undefined}
        onPreview={onPreview}
        vaultPath={vaultPath}
      />
    </div>
  );
}
