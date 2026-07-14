import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CoverPicker } from '../../../AssetLibrary';
import { CoverRenderer } from './CoverRenderer';
import type { CoverImageControllerModel } from './coverImage.types';
import { themeRenderingTokens } from '@/styles/themeTokens';

export function CoverImageShell({
  url,
  readOnly,
  notesRootPath,
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
  const shouldAnimateExistingCover = Boolean(url) && !displaySrc;
  const hadCoverRef = useRef(Boolean(url));
  const lastCoverFrameRef = useRef<{
    displaySrc: string;
    positionX: number;
    positionY: number;
    rendererProps: CoverImageControllerModel['rendererProps'];
  } | null>(null);
  const [collapsePending, setCollapsePending] = useState(false);

  if (url) {
    hadCoverRef.current = true;
    lastCoverFrameRef.current = { displaySrc, positionX, positionY, rendererProps };
  }

  const shouldStartCollapse = !url && hadCoverRef.current;
  const shouldRenderCollapse = collapsePending || shouldStartCollapse;
  const finishCollapse = useCallback(() => {
    hadCoverRef.current = false;
    lastCoverFrameRef.current = null;
    setCollapsePending(false);
  }, []);

  useLayoutEffect(() => {
    if (url) {
      if (collapsePending) setCollapsePending(false);
      return;
    }
    if (!shouldStartCollapse) return;

    setCollapsePending(true);
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const frame = requestAnimationFrame(finishCollapse);
    return () => cancelAnimationFrame(frame);
  }, [collapsePending, finishCollapse, shouldStartCollapse, url]);

  if (phase === 'idle' && !showPicker && !shouldRenderCollapse) {
    return null;
  }

  if (!url) {
    const collapseFrame = shouldRenderCollapse ? lastCoverFrameRef.current : null;
    const shouldHoldCoverSpace = phase === 'previewing' || phase === 'committing' || Boolean(previewSrc);
    const shouldShowEmptyPlaceholder = shouldHoldCoverSpace && !previewSrc;

    return (
      <div
        className={cn(
          'relative w-full shrink-0 animate-in fade-in-0 transition-[height] duration-[var(--vlaina-duration-200)] ease-out motion-reduce:animate-none motion-reduce:transition-none',
          (shouldHoldCoverSpace || collapseFrame) && 'bg-[var(--vlaina-bg-secondary)] overflow-hidden'
        )}
        ref={containerRef}
        data-note-cover-region="true"
        style={{ height: shouldHoldCoverSpace ? coverHeight : 0, overflowAnchor: themeRenderingTokens.overflowAnchorNone }}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === 'height' && collapseFrame) {
            finishCollapse();
          }
        }}
      >
        {collapseFrame ? (
          <CoverRenderer
            {...collapseFrame.rendererProps}
            displaySrc={collapseFrame.displaySrc}
            positionX={collapseFrame.positionX}
            positionY={collapseFrame.positionY}
          />
        ) : previewSrc ? (
          <CoverRenderer
            {...rendererProps}
            displaySrc={displaySrc || previewSrc}
            positionX={positionX}
            positionY={positionY}
          />
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
          notesRootPath={notesRootPath}
          currentNotePath={currentNotePath}
          anchorPlacement="empty-cover-option"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full bg-[var(--vlaina-bg-primary)] shrink-0 select-none overflow-hidden group',
        shouldAnimateExistingCover && 'animate-in fade-in-0 duration-[var(--vlaina-duration-150)] ease-out motion-reduce:animate-none'
      )}
      style={{ height: coverHeight, overflowAnchor: themeRenderingTokens.overflowAnchorNone }}
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
          className="absolute inset-0 cursor-pointer z-[var(--vlaina-z-10)]"
          onMouseDown={() => !readOnly && onOpenPicker()}
        />
      )}

      {readOnly && <div className="absolute inset-0 z-[var(--vlaina-z-20)]" />}

      {!readOnly && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-[var(--vlaina-z-10)] opacity-[var(--vlaina-opacity-0)] hover:opacity-[var(--vlaina-opacity-100)] transition-opacity"
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
        notesRootPath={notesRootPath}
        currentNotePath={currentNotePath}
      />
    </div>
  );
}
