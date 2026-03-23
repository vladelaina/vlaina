import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  sidebarResizeVariants,
  type SidebarResizeReleaseSnap,
  type SidebarResizeVariant,
} from '../variants/sidebarResizeVariants';

const MIN_WIDTH = 104;
const MAX_WIDTH = 284;
const DEFAULT_WIDTH = 172;
const SNAP_THRESHOLD = 16;
const EDGE_ZONE = 36;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function findNearestSnapPoint(points: number[] | undefined, width: number) {
  if (!points?.length) return null;
  let nearest = points[0];
  let nearestDistance = Math.abs(points[0] - width);

  for (const point of points.slice(1)) {
    const distance = Math.abs(point - width);
    if (distance < nearestDistance) {
      nearest = point;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function applyEdgeResistance(width: number, resistance: number) {
  if (resistance >= 1) return width;

  let next = width;

  if (next < MIN_WIDTH + EDGE_ZONE) {
    next = MIN_WIDTH + (next - MIN_WIDTH) * resistance;
  }

  if (next > MAX_WIDTH - EDGE_ZONE) {
    next = MAX_WIDTH - EDGE_ZONE + (next - (MAX_WIDTH - EDGE_ZONE)) * resistance;
  }

  return next;
}

function applyMagnet(width: number, points: number[] | undefined, strength: number) {
  const nearest = findNearestSnapPoint(points, width);
  if (nearest === null) return width;

  const distance = Math.abs(nearest - width);
  if (distance > 24) return width;

  return width + (nearest - width) * strength;
}

function applyStep(width: number, stepSize: number | undefined) {
  if (!stepSize) return width;
  return Math.round(width / stepSize) * stepSize;
}

function resolveReleaseWidth(
  width: number,
  points: number[] | undefined,
  releaseSnap: SidebarResizeReleaseSnap,
) {
  const nearest = findNearestSnapPoint(points, width);
  if (nearest === null || releaseSnap === 'none') {
    return clamp(width, MIN_WIDTH, MAX_WIDTH);
  }

  if (releaseSnap === 'always') {
    return clamp(nearest, MIN_WIDTH, MAX_WIDTH);
  }

  return Math.abs(nearest - width) <= SNAP_THRESHOLD
    ? clamp(nearest, MIN_WIDTH, MAX_WIDTH)
    : clamp(width, MIN_WIDTH, MAX_WIDTH);
}

function getHandleClassName(variant: SidebarResizeVariant, hovered: boolean, dragging: boolean) {
  if (variant.handleStyle === 'block') {
    return cn(
      'w-2.5 rounded-full border border-black/10 bg-white/90 shadow-[0_8px_18px_rgba(15,23,42,0.08)]',
      (hovered || dragging) && 'w-3.5',
    );
  }

  if (variant.handleStyle === 'pill') {
    return cn(
      'w-2 rounded-full bg-neutral-300/70',
      (hovered || dragging) && 'w-3 bg-neutral-500/80',
    );
  }

  return cn(
    'w-px bg-neutral-300',
    (hovered || dragging) && 'bg-neutral-700',
  );
}

function SidebarPreviewCard({ variant, index }: { variant: SidebarResizeVariant; index: number }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [commitFlash, setCommitFlash] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);
  const currentWidthRef = useRef(DEFAULT_WIDTH);
  const commitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    currentWidthRef.current = width;
  }, [width]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = event.clientX - startXRef.current;
      let nextWidth = startWidthRef.current + delta;

      if (variant.dragModel === 'resistive' || variant.dragModel === 'elastic') {
        nextWidth = applyEdgeResistance(nextWidth, variant.edgeResistance);
      }

      if (variant.dragModel === 'magnetic' || variant.dragModel === 'elastic') {
        nextWidth = applyMagnet(nextWidth, variant.snapPoints, variant.snapStrength);
      }

      if (variant.dragModel === 'stepped') {
        nextWidth = applyStep(nextWidth, variant.stepSize);
      }

      if (variant.dragModel === 'glide') {
        nextWidth = currentWidthRef.current + (nextWidth - currentWidthRef.current) * variant.smoothing;
      }

      nextWidth = clamp(nextWidth, MIN_WIDTH, MAX_WIDTH);
      currentWidthRef.current = nextWidth;
      setWidth(nextWidth);
    };

    const handlePointerUp = () => {
      const nextWidth = resolveReleaseWidth(currentWidthRef.current, variant.snapPoints, variant.releaseSnap);
      currentWidthRef.current = nextWidth;
      setWidth(nextWidth);
      setIsDragging(false);
      setCommitFlash(true);

      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }

      commitTimerRef.current = window.setTimeout(() => {
        setCommitFlash(false);
        commitTimerRef.current = null;
      }, 180);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, variant]);

  const nearestSnapPoint = useMemo(
    () => findNearestSnapPoint(variant.snapPoints, width),
    [variant.snapPoints, width],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = currentWidthRef.current;
    setIsDragging(true);
  };

  return (
    <div className={cn('flex flex-col gap-4 rounded-[28px] border p-5 shadow-[0_24px_40px_-34px_rgba(15,23,42,0.2)]', variant.surfaceClassName)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-mono font-semibold text-neutral-500">
            {String(index).padStart(2, '0')}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold text-neutral-950">{variant.name}</h3>
              {variant.recommended ? (
                <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                  Pick
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] leading-5 text-neutral-500">{variant.description}</p>
          </div>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', variant.badgeClassName)}>
          {variant.category}
        </span>
      </div>

      <div className={cn('relative overflow-hidden rounded-[22px] border border-black/5 p-4', variant.canvasClassName)}>
        <div className="mb-3 flex items-center justify-between text-[11px] text-neutral-500">
          <span>Drag the divider inside the card</span>
          <span>{Math.round(width)}px</span>
        </div>

        <div className="relative h-[168px] overflow-hidden rounded-[18px] border border-black/6 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-r-[18px] border-r border-black/6 bg-white transition-[width,box-shadow,transform] duration-150',
              isDragging && 'shadow-[0_18px_36px_rgba(15,23,42,0.08)]',
              commitFlash && 'shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_18px_36px_rgba(15,23,42,0.08)]',
            )}
            style={{ width }}
          >
            <div className="flex h-full flex-col gap-2 p-3">
              <div className={cn('h-2.5 w-12 rounded-full opacity-95', variant.accentClassName)} />
              <div className="h-2 rounded-full bg-neutral-200" />
              <div className="h-2 rounded-full bg-neutral-100" />
              <div className="mt-1 space-y-1.5">
                <div className="h-6 rounded-[10px] bg-neutral-100" />
                <div className="h-6 rounded-[10px] bg-neutral-50" />
                <div className="h-6 rounded-[10px] bg-neutral-100" />
              </div>
            </div>
          </div>

          <div className="absolute inset-y-0 right-0 left-0 overflow-hidden">
            <div className="absolute inset-0 p-4">
              <div className="grid gap-2">
                <div className="h-3 w-28 rounded-full bg-neutral-200" />
                <div className="h-2 rounded-full bg-neutral-100" />
                <div className="h-2 rounded-full bg-neutral-100" />
                <div className="h-2 w-[82%] rounded-full bg-neutral-100" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-16 rounded-[14px] bg-neutral-50" />
                  <div className="h-16 rounded-[14px] bg-neutral-50" />
                </div>
              </div>
            </div>
          </div>

          {variant.showScrim ? (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 bg-black/[0.03] transition-opacity duration-150"
              style={{
                left: width,
                opacity: isDragging ? 1 : 0.45,
              }}
            />
          ) : null}

          {variant.showGhost && nearestSnapPoint !== null ? (
            <div
              className="pointer-events-none absolute inset-y-3 rounded-r-[16px] border border-dashed border-black/15 bg-black/[0.03]"
              style={{ width: nearestSnapPoint }}
            />
          ) : null}

          {variant.showTicks && variant.snapPoints?.length ? (
            <div className="pointer-events-none absolute inset-x-4 bottom-3 h-2">
              {variant.snapPoints.map((point) => (
                <div
                  key={point}
                  className={cn('absolute top-0 h-2 w-px bg-black/10 transition-colors', nearestSnapPoint === point && 'bg-black/30')}
                  style={{ left: `${((point - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 100}%` }}
                />
              ))}
            </div>
          ) : null}

          {variant.showPreviewBar ? (
            <div
              className={cn('pointer-events-none absolute top-0 bottom-0 transition-opacity duration-150', variant.accentClassName)}
              style={{
                left: width - 1,
                width: isDragging || isHovered ? 2 : 1,
                opacity: isDragging ? 0.95 : isHovered ? 0.55 : 0.2,
              }}
            />
          ) : null}

          <button
            type="button"
            aria-label={`${variant.name} resize handle`}
            onPointerDown={handlePointerDown}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="absolute inset-y-0 z-10 flex cursor-col-resize items-center justify-center bg-transparent"
            style={{ left: width - 10, width: 20 }}
          >
            <div className={cn('h-[78%] transition-all duration-150', getHandleClassName(variant, isHovered, isDragging))} />
          </button>

          {variant.showBadge ? (
            <div
              className="pointer-events-none absolute top-3 z-10 -translate-x-1/2 rounded-full border border-black/10 bg-white/95 px-2 py-1 text-[10px] font-semibold text-neutral-600 shadow-[0_6px_18px_rgba(15,23,42,0.08)]"
              style={{ left: width }}
            >
              {Math.round(width)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SidebarResizeLab() {
  const recommended = sidebarResizeVariants.filter((variant) => variant.recommended);

  return (
    <div className="mx-auto flex max-w-[1560px] flex-col gap-8 pb-24">
      <div className="max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Sidebar Resize Lab</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          Thirty interaction directions for fixing the sidebar drag experience
        </h2>
        <p className="mt-4 max-w-3xl text-[14px] leading-7 text-neutral-600">
          The current problem is not only animation lag. It is also target discovery, edge resistance, commit confidence,
          and whether the user can predict the final width. This lab isolates those choices into 30 draggable prototypes.
        </p>
      </div>

      <div className="grid gap-3 rounded-[24px] border border-neutral-200 bg-white p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)] md:grid-cols-3">
        {recommended.map((variant) => (
          <div key={variant.id} className="rounded-[18px] border border-neutral-200 bg-neutral-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Recommended</div>
            <div className="mt-2 text-[15px] font-semibold text-neutral-950">{variant.name}</div>
            <p className="mt-1 text-[12px] leading-5 text-neutral-500">{variant.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-3">
        {sidebarResizeVariants.map((variant, index) => (
          <SidebarPreviewCard key={variant.id} variant={variant} index={index + 1} />
        ))}
      </div>
    </div>
  );
}
