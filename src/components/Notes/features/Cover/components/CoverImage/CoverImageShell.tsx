import { cn } from '@/lib/utils';
import { CoverPicker } from '../../../AssetLibrary';
import { CoverRenderer } from './CoverRenderer';
import { useDelayedVisibleFlag } from './hooks/display/useDelayedVisibleFlag';
import type { CoverImageControllerModel } from './coverImage.types';

const COVER_ERROR_DISPLAY_DELAY_MS = 250;

export function CoverImageShell({
  url,
  readOnly,
  vaultPath,
  currentNotePath,
  phase,
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
}: CoverImageControllerModel) {
  const showErrorMessage = useDelayedVisibleFlag(isError, COVER_ERROR_DISPLAY_DELAY_MS);

  if (phase === 'idle' && !showPicker) {
    return null;
  }

  if (!url) {
    return (
      <div
        className="relative w-full animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none"
        data-note-cover-region="true"
      >
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
          currentNotePath={currentNotePath}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full bg-[var(--vlaina-bg-primary)] shrink-0 select-none overflow-hidden group',
        'animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none'
      )}
      style={{ height: coverHeight, overflowAnchor: 'none' }}
      ref={containerRef}
      data-note-cover-region="true"
    >
      <CoverRenderer
        {...rendererProps}
        displaySrc={displaySrc}
        positionX={positionX}
        positionY={positionY}
      />

      {showErrorMessage && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-muted/20 text-muted-foreground z-10',
            !readOnly && 'cursor-pointer hover:bg-muted/30 transition-colors'
          )}
          onMouseDown={() => !readOnly && onOpenPicker()}
        >
          <span className="text-xs font-medium opacity-70">Image failed to load</span>
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
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10 opacity-0 hover:opacity-100 transition-opacity"
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
        currentNotePath={currentNotePath}
      />
    </div>
  );
}
