import { memo, type PointerEvent } from 'react';
import { Icon } from '@/components/ui/icons';
import { themeIconTokens, themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardRulerState } from '../hooks/useWhiteboardRuler';

interface WhiteboardRulerOverlayProps {
  closeLabel: string;
  interactive: boolean;
  ruler: WhiteboardRulerState;
  rotateLabel: string;
  zoom: number;
  onClose: () => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, mode: 'move' | 'rotate') => void;
}

export const WhiteboardRulerOverlay = memo(function WhiteboardRulerOverlay({
  closeLabel,
  interactive,
  ruler,
  rotateLabel,
  zoom,
  onClose,
  onPointerDown,
}: WhiteboardRulerOverlayProps) {
  if (!ruler.visible) return null;
  const ticks = Array.from({ length: themeWhiteboardTokens.rulerTickCount }, (_, index) => index);
  const majorTicks = ticks.filter((tick) => tick % themeWhiteboardTokens.rulerMajorTickEvery === 0);
  const handleClosePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  return (
    <div
      className="absolute select-none overflow-hidden rounded-[var(--vlaina-radius-8px)] border border-[var(--vlaina-color-whiteboard-ruler-border)] bg-[var(--vlaina-color-whiteboard-ruler-bg)] shadow-[var(--vlaina-shadow-toolbar)] backdrop-blur-[var(--vlaina-blur-sm)]"
      onPointerDown={interactive ? (event) => onPointerDown(event, 'move') : undefined}
      style={{
        cursor: interactive ? 'move' : 'default',
        height: themeWhiteboardTokens.rulerHeightPx,
        left: ruler.x - themeWhiteboardTokens.rulerWidthPx / 2,
        pointerEvents: interactive ? 'auto' : 'none',
        top: ruler.y - themeWhiteboardTokens.rulerHeightPx / 2,
        transform: `rotate(${ruler.angle}deg) scale(${1 / zoom})`,
        transformOrigin: '50% 50%',
        width: themeWhiteboardTokens.rulerWidthPx,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[var(--vlaina-color-whiteboard-ruler-mark)] opacity-[var(--vlaina-opacity-30)]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-[var(--vlaina-color-whiteboard-ruler-mark)] opacity-[var(--vlaina-opacity-45)]" />
      <div className="absolute left-0 top-0 h-full w-px bg-[var(--vlaina-color-whiteboard-ruler-mark)] opacity-[var(--vlaina-opacity-30)]" />
      <div className="absolute right-0 top-0 h-full w-px bg-[var(--vlaina-color-whiteboard-ruler-mark)] opacity-[var(--vlaina-opacity-30)]" />
      <div
        className="absolute inset-x-0 top-0 flex h-full justify-between"
        style={{ paddingInline: themeWhiteboardTokens.rulerTickInsetPx }}
      >
        {ticks.map((tick) => (
          <div
            key={tick}
            className="w-px bg-[var(--vlaina-color-whiteboard-ruler-mark)]"
            style={{
              height: getRulerTickHeight(tick),
            }}
          />
        ))}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 flex h-full items-end justify-between"
        style={{ paddingInline: themeWhiteboardTokens.rulerTickInsetPx }}
      >
        {ticks.map((tick) => (
          <div
            key={tick}
            className="w-px bg-[var(--vlaina-color-whiteboard-ruler-mark)]"
            style={{
              height: getRulerTickHeight(tick),
            }}
          />
        ))}
      </div>
      <div
        className="absolute top-1/2 flex -translate-y-1/2 justify-between text-[var(--vlaina-font-10)] font-medium text-[var(--vlaina-color-whiteboard-ruler-mark)]"
        style={{
          left: themeWhiteboardTokens.rulerLabelInsetPx,
          right: themeWhiteboardTokens.rulerLabelInsetPx,
        }}
      >
        {majorTicks.map((tick, index) => (
          <span key={tick}>{index}</span>
        ))}
      </div>
      <div
        className="absolute top-1/2 h-px bg-[var(--vlaina-color-whiteboard-ruler-mark)] opacity-[var(--vlaina-opacity-45)]"
        style={{
          left: themeWhiteboardTokens.rulerCenterLineInsetPx,
          right: themeWhiteboardTokens.rulerCenterLineInsetPx,
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-between rounded-[var(--vlaina-radius-pill)] border border-[var(--vlaina-color-whiteboard-ruler-border)] bg-[var(--vlaina-color-floating-surface)] px-2 opacity-[var(--vlaina-opacity-70)]"
        style={{
          height: themeWhiteboardTokens.rulerGripHeightPx,
          width: themeWhiteboardTokens.rulerGripWidthPx,
        }}
      >
        {Array.from({ length: themeWhiteboardTokens.rulerGripTickCount }, (_, index) => (
          <span key={index} className="h-1 w-px bg-[var(--vlaina-color-whiteboard-ruler-mark)] opacity-[var(--vlaina-opacity-45)]" />
        ))}
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        className="absolute right-10 top-1/2 flex size-[var(--vlaina-size-24px)] -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--vlaina-radius-circle)] border border-[var(--vlaina-color-whiteboard-ruler-border)] bg-[var(--vlaina-color-floating-surface)] text-[var(--vlaina-color-text-secondary)] hover:text-[var(--vlaina-color-text-primary)]"
        onClick={onClose}
        onPointerDown={handleClosePointerDown}
        style={{ pointerEvents: 'auto' }}
      >
        <Icon name="common.close" size={themeIconTokens.sizeXs} />
      </button>
      <button
        type="button"
        aria-label={rotateLabel}
        className="absolute right-2 top-1/2 flex size-[var(--vlaina-size-24px)] -translate-y-1/2 cursor-alias items-center justify-center rounded-[var(--vlaina-radius-circle)] border border-[var(--vlaina-color-whiteboard-ruler-border)] bg-[var(--vlaina-color-floating-surface)] text-[var(--vlaina-color-text-secondary)] hover:text-[var(--vlaina-color-text-primary)]"
        onPointerDown={(event) => onPointerDown(event, 'rotate')}
        style={{ pointerEvents: 'auto' }}
      >
        <Icon name="common.refresh" size={themeIconTokens.sizeXs} />
      </button>
    </div>
  );
});

function getRulerTickHeight(tick: number): number {
  if (tick % themeWhiteboardTokens.rulerMajorTickEvery === 0) return themeWhiteboardTokens.rulerMajorTickHeightPx;
  if (tick % themeWhiteboardTokens.rulerHalfTickEvery === 0) return themeWhiteboardTokens.rulerHalfTickHeightPx;
  return themeWhiteboardTokens.rulerMinorTickHeightPx;
}
