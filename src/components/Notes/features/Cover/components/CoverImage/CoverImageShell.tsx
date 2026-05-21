import { cn } from '@/lib/utils';
import { CoverPicker } from '../../../AssetLibrary';
import { CoverRenderer } from './CoverRenderer';
import type { CoverImageControllerModel } from './coverImage.types';

export function CoverImageShell({
  url,
  readOnly,
  vaultPath,
  currentNotePath,
  phase,
  showPicker,
  previewSrc,
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
  if (phase === 'idle' && !showPicker) {
    return null;
  }

  if (!url) {
    const shouldHoldCoverSpace = showPicker || phase === 'previewing' || phase === 'committing' || Boolean(previewSrc);
    const shouldShowEmptyPlaceholder = shouldHoldCoverSpace && !previewSrc;

    return (
      <div
        className={cn(
          'relative w-full shrink-0 animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none',
          shouldHoldCoverSpace && 'bg-[var(--vlaina-bg-secondary)] overflow-hidden'
        )}
        data-note-cover-region="true"
        style={shouldHoldCoverSpace ? { height: coverHeight, overflowAnchor: 'none' } : undefined}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
        ) : shouldShowEmptyPlaceholder ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[var(--vlaina-bg-secondary)]"
          />
        ) : null}
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

      {!displaySrc && (
        <div
          className="absolute inset-0 cursor-pointer z-10"
          onMouseDown={() => !readOnly && onOpenPicker()}
        />
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
