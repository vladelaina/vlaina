import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  TABLE_COLUMN_DRAG_PINNED_OPTION_NUMBERS,
  TABLE_COLUMN_DRAG_VARIANTS,
  type TableColumnDragActivationZone,
  type TableColumnDragCursorMode,
  type TableColumnDragDropFeedbackMode,
  type TableColumnDragDragStartMode,
  type TableColumnDragHoverHoldMode,
  type TableColumnDragRevealMode,
  type TableColumnDragVariant,
  type TableColumnDragHandleStyle,
} from '../variants/tableColumnDragVariants';

type DemoColumn = {
  id: string;
  label: string;
  width: number;
};

type DemoRow = Record<DemoColumn['id'], string>;

type HoverState = {
  index: number;
  localX: number;
  localY: number;
  clientX: number;
  clientY: number;
};

type PendingDragState = {
  pointerId: number;
  fromIndex: number;
  startX: number;
  startY: number;
  startedAt: number;
};

type DragState = {
  pointerId: number;
  fromIndex: number;
  boundaryIndex: number;
  targetIndex: number;
  clientX: number;
  clientY: number;
  startedAt: number;
};

type HeaderHit = {
  index: number;
  rect: DOMRect;
  localX: number;
  localY: number;
};

const DEMO_COLUMNS: DemoColumn[] = [
  { id: 'title', label: 'Title', width: 1.45 },
  { id: 'status', label: 'Status', width: 0.9 },
  { id: 'owner', label: 'Owner', width: 1.05 },
  { id: 'updated', label: 'Updated', width: 1.1 },
];

const DEMO_ROWS: DemoRow[] = [
  { title: 'Q2 planning', status: 'Draft', owner: 'Mika', updated: '12m ago' },
  { title: 'Release notes', status: 'Review', owner: 'Iris', updated: '48m ago' },
  { title: 'Research brief', status: 'Ready', owner: 'Noah', updated: '2h ago' },
];

const HANDLE_WIDTH = 36;
const HANDLE_HEIGHT = 18;

const ACTIVATION_LABELS: Record<TableColumnDragActivationZone, string> = {
  'full-header': 'Full header',
  'top-band': 'Top band',
  'top-line': 'Top line',
  'center-band': 'Center lane',
  'edge-band': 'Edge pockets',
};

const REVEAL_LABELS: Record<TableColumnDragRevealMode, string> = {
  centered: 'Centered',
  'pointer-follow': 'Pointer follow',
  'edge-snap': 'Nearest edge',
  glide: 'Soft glide',
  'line-condense': 'Rail to oval',
  magnet: 'Magnetic',
};

const START_LABELS: Record<TableColumnDragDragStartMode, string> = {
  immediate: 'Immediate',
  'threshold-sm': '4px guard',
  'threshold-lg': '10px guard',
  dwell: 'Press hold',
};

const DROP_LABELS: Record<TableColumnDragDropFeedbackMode, string> = {
  line: 'Insert line',
  pill: 'Insert pill',
  'header-tint': 'Header tint',
  'column-tint': 'Column tint',
  ghost: 'Ghost chip',
  push: 'Push aside',
};

function reorderColumnsToBoundary(
  columns: DemoColumn[],
  fromIndex: number,
  boundaryIndex: number
) {
  const next = [...columns];
  const [moved] = next.splice(fromIndex, 1);
  const adjustedBoundaryIndex = boundaryIndex > fromIndex ? boundaryIndex - 1 : boundaryIndex;
  next.splice(adjustedBoundaryIndex, 0, moved);
  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCursorStyle(cursorMode: TableColumnDragCursorMode): CSSProperties {
  return { cursor: cursorMode };
}

function getHoldDelay(hoverHoldMode: TableColumnDragHoverHoldMode) {
  if (hoverHoldMode === 'brief') return 140;
  if (hoverHoldMode === 'sticky') return 320;
  return 0;
}

function getDragThreshold(dragStartMode: TableColumnDragDragStartMode) {
  if (dragStartMode === 'threshold-sm') return 4;
  if (dragStartMode === 'threshold-lg') return 10;
  if (dragStartMode === 'dwell') return 14;
  return 0;
}

function resolveHandleCenter(
  width: number,
  localX: number,
  revealMode: TableColumnDragRevealMode
) {
  if (revealMode === 'pointer-follow') {
    return clamp(localX, 22, width - 22);
  }

  if (revealMode === 'edge-snap') {
    return localX < width / 2 ? 24 : width - 24;
  }

  if (revealMode === 'glide') {
    return clamp(width / 2 + (localX - width / 2) * 0.45, 22, width - 22);
  }

  if (revealMode === 'magnet') {
    const anchors = [width * 0.28, width * 0.5, width * 0.72];
    return anchors.reduce((closest, anchor) =>
      Math.abs(anchor - localX) < Math.abs(closest - localX) ? anchor : closest
    );
  }

  return width / 2;
}

function isActivationHit(
  hit: HeaderHit,
  activationZone: TableColumnDragActivationZone
) {
  const { rect, localX, localY } = hit;

  if (activationZone === 'full-header') return true;
  if (activationZone === 'top-band') return localY <= 20;
  if (activationZone === 'top-line') return localY <= 8;
  if (activationZone === 'center-band') {
    return localY <= 20 && Math.abs(localX - rect.width / 2) <= 34;
  }

  return localY <= 20 && (localX <= 30 || localX >= rect.width - 30);
}

function DragHandle({
  style,
  isDragging,
}: {
  style: TableColumnDragHandleStyle;
  isDragging: boolean;
}) {
  const baseColor = 'bg-[#6b7280]';
  const activeColor = 'bg-[#2563eb]';
  const color = isDragging ? activeColor : baseColor;

  switch (style) {
    case 'notion-baseline':
      return (
        <div className="relative h-full w-full">
          <span
            className={cn(
              'absolute inset-x-[8px] top-1/2 h-px -translate-y-1/2 rounded-full transition-colors',
              color
            )}
          />
        </div>
      );
    case 'minimal-dot':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-1 w-1 rounded-full transition-colors', color)} />
        </div>
      );
    case 'triple-dot':
      return (
        <div className="flex h-full w-full items-center justify-center gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn('h-1 w-1 rounded-full transition-colors', color)} />
          ))}
        </div>
      );
    case 'grip-vertical':
      return (
        <div className="grid h-full w-full grid-cols-2 place-content-center gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn('h-0.5 w-0.5 rounded-full transition-colors', color)} />
          ))}
        </div>
      );
    case 'double-line':
      return (
        <div className="flex h-full w-full items-center justify-center gap-1">
          <div className={cn('h-2 w-px rounded-full transition-colors', color)} />
          <div className={cn('h-2 w-px rounded-full transition-colors', color)} />
        </div>
      );
    case 'pill-filled':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-1.5 w-6 rounded-full transition-colors', color)} />
        </div>
      );
    case 'ghost-pill':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className={cn(
              'h-2 w-6 rounded-full border border-[#6b7280] transition-colors',
              isDragging && 'border-[#2563eb]'
            )}
          />
        </div>
      );
    case 'plus-thin':
      return (
        <div className="relative h-full w-full">
          <div className={cn('absolute inset-x-3 top-1/2 h-px -translate-y-1/2', color)} />
          <div className={cn('absolute inset-y-1.5 left-1/2 w-px -translate-x-1/2', color)} />
        </div>
      );
    case 'chevron-pair':
      return (
        <div className="flex h-full w-full items-center justify-center gap-3">
          <div
            className={cn(
              'h-1 w-1 rotate-45 border-b border-l border-[#6b7280]',
              isDragging && 'border-[#2563eb]'
            )}
          />
          <div
            className={cn(
              'h-1 w-1 -rotate-[135deg] border-b border-l border-[#6b7280]',
              isDragging && 'border-[#2563eb]'
            )}
          />
        </div>
      );
    case 'dash-long':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-px w-8 transition-colors', color)} />
        </div>
      );
    case 'diamond-small':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-1.5 w-1.5 rotate-45 transition-colors', color)} />
        </div>
      );
    case 'hollow-circle':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full border border-[#6b7280]',
              isDragging && 'border-[#2563eb]'
            )}
          />
        </div>
      );
    case 'brackets':
      return (
        <div className="flex h-full w-full items-center justify-center gap-4">
          <div
            className={cn(
              'h-2 w-1 border-b border-l border-t border-[#6b7280]',
              isDragging && 'border-[#2563eb]'
            )}
          />
          <div
            className={cn(
              'h-2 w-1 border-b border-r border-t border-[#6b7280]',
              isDragging && 'border-[#2563eb]'
            )}
          />
        </div>
      );
    case 'wave-line':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <svg width="24" height="4" viewBox="0 0 24 4" fill="none">
            <path
              d="M0 2C4 2 4 0 8 0C12 0 12 4 16 4C20 4 20 2 24 2"
              stroke={isDragging ? '#2563eb' : '#6b7280'}
              strokeWidth="1"
            />
          </svg>
        </div>
      );
    case 'corner-fold':
      return (
        <div className="relative h-full w-full">
          <div
            className={cn(
              'absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 border-l border-t border-[#6b7280]',
              isDragging && 'border-[#2563eb]'
            )}
          />
        </div>
      );
    case 'crosshair-tiny':
      return (
        <div className="relative h-full w-full">
          <div className={cn('absolute left-1/2 top-1 h-1 w-px -translate-x-1/2', color)} />
          <div className={cn('absolute bottom-1 left-1/2 h-1 w-px -translate-x-1/2', color)} />
          <div className={cn('absolute left-2.5 top-1/2 h-px w-1 -translate-y-1/2', color)} />
          <div className={cn('absolute right-2.5 top-1/2 h-px w-1 -translate-y-1/2', color)} />
        </div>
      );
    case 'pixel-grid':
      return (
        <div className="grid h-full w-full grid-cols-2 place-content-center gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn('h-1 w-1 transition-colors', color)} />
          ))}
        </div>
      );
    case 'bar-trio':
      return (
        <div className="flex h-full w-full items-end justify-center gap-0.5 pb-2">
          <div className={cn('h-1.5 w-1 rounded-t-sm transition-colors', color)} />
          <div className={cn('h-2.5 w-1 rounded-t-sm transition-colors', color)} />
          <div className={cn('h-2 w-1 rounded-t-sm transition-colors', color)} />
        </div>
      );
    case 'slash-diagonal':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-4 w-px rotate-[25deg] transition-colors', color)} />
        </div>
      );
    case 'underline-glow':
      return (
        <div className="flex h-full w-full items-end justify-center pb-1">
          <div
            className={cn(
              'h-px w-6 transition-all',
              color,
              isDragging && 'shadow-[0_0_8px_rgba(37,99,235,0.6)]'
            )}
          />
        </div>
      );
    case 'overhang-tab':
      return (
        <div className="flex h-full w-full items-start justify-center">
          <div className={cn('h-1 w-4 rounded-b-sm transition-colors', color)} />
        </div>
      );
    case 'knurled-texture':
      return (
        <div className="flex h-full w-full items-center justify-center gap-px">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={cn('h-2 w-px -rotate-12 transition-colors', color)} />
          ))}
        </div>
      );
    case 'target-ring':
      return (
        <div className="relative h-full w-full items-center justify-center flex">
          <div className={cn('h-3 w-3 rounded-full border border-[#6b7280]', isDragging && 'border-[#2563eb]')} />
          <div className={cn('absolute h-1 w-1 rounded-full', color)} />
        </div>
      );
    case 'arrow-indicator':
      return (
        <div className="flex h-full w-full items-center justify-center flex-col gap-0.5">
          <div className={cn('h-0.5 w-3 rounded-full transition-colors', color)} />
          <div className={cn('h-0.5 w-3 rounded-full transition-colors', color)} />
        </div>
      );
    case 'eye-minimal':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-2 w-4 rounded-full border border-[#6b7280] flex items-center justify-center', isDragging && 'border-[#2563eb]')}>
            <div className={cn('h-1 w-1 rounded-full', color)} />
          </div>
        </div>
      );
    case 'stitch-mark':
      return (
        <div className="relative h-full w-full">
          <div className={cn('absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 rotate-45', color)} />
          <div className={cn('absolute left-1/2 top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 -rotate-45', color)} />
        </div>
      );
    case 'pulse-line':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <svg width="24" height="8" viewBox="0 0 24 8" fill="none">
            <path
              d="M0 4H8L10 1L14 7L16 4H24"
              stroke={isDragging ? '#2563eb' : '#6b7280'}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    case 'infinity-loop':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
            <path
              d="M5 2C2.5 2 2 5 2 5C2 5 2.5 8 5 8C7.5 8 12.5 2 15 2C17.5 2 18 5 18 5C18 5 17.5 8 15 8C12.5 8 7.5 2 5 2Z"
              stroke={isDragging ? '#2563eb' : '#6b7280'}
              strokeWidth="1"
            />
          </svg>
        </div>
      );
    case 'square-outline':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-2.5 w-2.5 border border-[#6b7280]', isDragging && 'border-[#2563eb]')} />
        </div>
      );
    case 'floating-island':
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className={cn('h-2 w-6 rounded shadow-sm transition-colors', color)} />
        </div>
      );
    default:
      return null;
  }
}

function TableDragPreview({ variant }: { variant: TableColumnDragVariant }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hoverClearTimerRef = useRef<number | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const [orderedColumns, setOrderedColumns] = useState(DEMO_COLUMNS);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const [pendingDrag, setPendingDrag] = useState<PendingDragState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const templateColumns = useMemo(
    () => orderedColumns.map((column) => `${column.width}fr`).join(' '),
    [orderedColumns]
  );

  const clearHoverTimer = () => {
    if (hoverClearTimerRef.current != null) {
      window.clearTimeout(hoverClearTimerRef.current);
      hoverClearTimerRef.current = null;
    }
  };

  const clearDwellTimer = () => {
    if (dwellTimerRef.current != null) {
      window.clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  };

  const scheduleHoverClear = (hoverHoldMode: TableColumnDragHoverHoldMode) => {
    clearHoverTimer();
    const delay = getHoldDelay(hoverHoldMode);
    if (delay === 0) {
      setHoverState(null);
      return;
    }

    hoverClearTimerRef.current = window.setTimeout(() => {
      setHoverState(null);
      hoverClearTimerRef.current = null;
    }, delay);
  };

  const resolveHeaderHit = (clientX: number, clientY: number): HeaderHit | null => {
    for (let index = 0; index < headerRefs.current.length; index += 1) {
      const header = headerRefs.current[index];
      if (!header) continue;
      const rect = header.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return {
          index,
          rect,
          localX: clientX - rect.left,
          localY: clientY - rect.top,
        };
      }
    }

    return null;
  };

  const resolveMagnetBoundary = (clientX: number) => {
    const headers = headerRefs.current.filter(
      (header): header is HTMLDivElement => header != null
    );
    if (headers.length === 0) {
      return { boundaryIndex: 0, targetIndex: 0 };
    }

    const boundaries = [
      {
        boundaryIndex: 0,
        x: headers[0].getBoundingClientRect().left,
      },
      ...headers.map((header, index) => ({
        boundaryIndex: index + 1,
        x: header.getBoundingClientRect().right,
      })),
    ];

    const closest = boundaries.reduce((winner, current) =>
      Math.abs(current.x - clientX) < Math.abs(winner.x - clientX) ? current : winner
    );

    return {
      boundaryIndex: closest.boundaryIndex,
      targetIndex: clamp(
        closest.boundaryIndex === orderedColumns.length
          ? orderedColumns.length - 1
          : closest.boundaryIndex,
        0,
        orderedColumns.length - 1
      ),
    };
  };

  const resolveDropTarget = (
    clientX: number,
    clientY: number,
    fromIndex: number,
    currentBoundaryIndex: number
  ) => {
    if (variant.snapMode === 'magnet') {
      return resolveMagnetBoundary(clientX);
    }

    const hit = resolveHeaderHit(clientX, clientY);
    if (!hit) {
      return {
        boundaryIndex: currentBoundaryIndex,
        targetIndex: clamp(
          currentBoundaryIndex === orderedColumns.length
            ? orderedColumns.length - 1
            : currentBoundaryIndex,
          0,
          orderedColumns.length - 1
        ),
      };
    }

    const width = hit.rect.width;

    if (variant.snapMode === 'edges') {
      if (hit.localX <= 18) {
        return { boundaryIndex: hit.index, targetIndex: hit.index };
      }

      if (hit.localX >= width - 18) {
        return { boundaryIndex: hit.index + 1, targetIndex: hit.index };
      }

      return { boundaryIndex: currentBoundaryIndex, targetIndex: hit.index };
    }

    if (variant.snapMode === 'thirds') {
      if (hit.localX <= width / 3) {
        return { boundaryIndex: hit.index, targetIndex: hit.index };
      }

      if (hit.localX >= (width * 2) / 3) {
        return { boundaryIndex: hit.index + 1, targetIndex: hit.index };
      }

      return {
        boundaryIndex: fromIndex < hit.index ? hit.index : hit.index + 1,
        targetIndex: hit.index,
      };
    }

    return {
      boundaryIndex: hit.localX < width / 2 ? hit.index : hit.index + 1,
      targetIndex: hit.index,
    };
  };

  const beginDrag = (
    pointerId: number,
    fromIndex: number,
    clientX: number,
    clientY: number
  ) => {
    const { boundaryIndex, targetIndex } = resolveDropTarget(
      clientX,
      clientY,
      fromIndex,
      fromIndex
    );
    setPendingDrag(null);
    setDragState({
      pointerId,
      fromIndex,
      boundaryIndex,
      targetIndex,
      clientX,
      clientY,
      startedAt: performance.now(),
    });
  };

  useEffect(() => {
    return () => {
      clearHoverTimer();
      clearDwellTimer();
    };
  }, []);

  useEffect(() => {
    if (!pendingDrag && !dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (dragState) {
        if (event.pointerId !== dragState.pointerId) return;
        const { boundaryIndex, targetIndex } = resolveDropTarget(
          event.clientX,
          event.clientY,
          dragState.fromIndex,
          dragState.boundaryIndex
        );
        setDragState((current) =>
          current == null
            ? current
            : {
                ...current,
                clientX: event.clientX,
                clientY: event.clientY,
                boundaryIndex,
                targetIndex,
              }
        );
        return;
      }

      if (!pendingDrag || event.pointerId !== pendingDrag.pointerId) return;

      const distance = Math.hypot(
        event.clientX - pendingDrag.startX,
        event.clientY - pendingDrag.startY
      );

      if (
        variant.dragStartMode === 'dwell' &&
        distance >= getDragThreshold(variant.dragStartMode)
      ) {
        clearDwellTimer();
        beginDrag(
          pendingDrag.pointerId,
          pendingDrag.fromIndex,
          event.clientX,
          event.clientY
        );
        return;
      }

      if (
        variant.dragStartMode !== 'dwell' &&
        distance >= getDragThreshold(variant.dragStartMode)
      ) {
        beginDrag(
          pendingDrag.pointerId,
          pendingDrag.fromIndex,
          event.clientX,
          event.clientY
        );
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      clearDwellTimer();

      if (dragState && event.pointerId === dragState.pointerId) {
        setOrderedColumns((columns) =>
          reorderColumnsToBoundary(columns, dragState.fromIndex, dragState.boundaryIndex)
        );

        const hit = resolveHeaderHit(event.clientX, event.clientY);
        if (hit && isActivationHit(hit, variant.activationZone)) {
          setHoverState({
            index: hit.index,
            localX: hit.localX,
            localY: hit.localY,
            clientX: event.clientX,
            clientY: event.clientY,
          });
        } else {
          setHoverState(null);
        }

        setDragState(null);
      }

      if (pendingDrag && event.pointerId === pendingDrag.pointerId) {
        setPendingDrag(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, pendingDrag, variant]);

  const handleSurfacePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState || pendingDrag) return;
    const hit = resolveHeaderHit(event.clientX, event.clientY);
    if (!hit || !isActivationHit(hit, variant.activationZone)) {
      scheduleHoverClear(variant.hoverHoldMode);
      return;
    }

    clearHoverTimer();
    setHoverState({
      index: hit.index,
      localX: hit.localX,
      localY: hit.localY,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const handleSurfacePointerLeave = () => {
    if (dragState || pendingDrag) return;
    scheduleHoverClear(variant.hoverHoldMode);
  };

  const handleState = (() => {
    const sourceIndex =
      dragState?.fromIndex ?? pendingDrag?.fromIndex ?? hoverState?.index ?? null;
    if (sourceIndex == null) return null;

    const header = headerRefs.current[sourceIndex];
    if (!header) return null;

    const rect = header.getBoundingClientRect();
    const localX =
      dragState?.clientX != null
        ? dragState.clientX - rect.left
        : pendingDrag?.startX != null
          ? pendingDrag.startX - rect.left
          : hoverState?.localX ?? rect.width / 2;

    return {
      index: sourceIndex,
      width: rect.width,
      centerX: resolveHandleCenter(rect.width, localX, variant.revealMode),
    };
  })();

  const shellMetrics = useMemo(() => {
    const shell = shellRef.current;
    if (!shell) return null;
    const rect = shell.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }, [dragState, orderedColumns, hoverState, pendingDrag]);

  const boundaryLeft = (() => {
    if (!dragState || !shellRef.current) return null;
    const shellRect = shellRef.current.getBoundingClientRect();

    if (dragState.boundaryIndex <= 0) {
      const first = headerRefs.current[0];
      return first ? first.getBoundingClientRect().left - shellRect.left : 0;
    }

    if (dragState.boundaryIndex >= orderedColumns.length) {
      const last = headerRefs.current[orderedColumns.length - 1];
      return last ? last.getBoundingClientRect().right - shellRect.left : shellRect.width;
    }

    const header = headerRefs.current[dragState.boundaryIndex];
    return header ? header.getBoundingClientRect().left - shellRect.left : 0;
  })();

  const getColumnShift = (index: number) => {
    if (!dragState || variant.dropFeedbackMode !== 'push') return 0;

    if (dragState.fromIndex < dragState.boundaryIndex) {
      if (index > dragState.fromIndex && index < dragState.boundaryIndex) {
        return -14;
      }
      return 0;
    }

    if (dragState.fromIndex > dragState.boundaryIndex) {
      if (index >= dragState.boundaryIndex && index < dragState.fromIndex) {
        return 14;
      }
    }

    return 0;
  };

  const renderDropFeedback = () => {
    if (!dragState || boundaryLeft == null || shellMetrics == null) return null;

    if (variant.dropFeedbackMode === 'pill') {
      return (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#2563eb]/85 shadow-[0_0_0_1px_rgba(37,99,235,0.14),0_0_16px_rgba(37,99,235,0.16)]"
          style={{
            left: boundaryLeft,
            top: 14,
            width: 8,
            height: shellMetrics.height - 28,
          }}
        />
      );
    }

    return (
      <div
        className="pointer-events-none absolute -translate-x-1/2 rounded-full bg-[#2563eb]/85 shadow-[0_0_0_1px_rgba(37,99,235,0.14),0_0_16px_rgba(37,99,235,0.16)]"
        style={{
          left: boundaryLeft,
          top: 14,
          width: 2,
          height: shellMetrics.height - 28,
        }}
      />
    );
  };

  const renderGhostFeedback = () => {
    if (
      !dragState ||
      variant.dropFeedbackMode !== 'ghost' ||
      !shellRef.current ||
      !shellMetrics
    ) {
      return null;
    }

    const shellRect = shellRef.current.getBoundingClientRect();
    const ghostLeft = dragState.clientX - shellRect.left;
    const ghostTop = clamp(dragState.clientY - shellRect.top - 28, 8, shellMetrics.height - 34);

    return (
      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#d6d9de] bg-white/98 px-3 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.28)] flex items-center justify-center"
        style={{
          left: ghostLeft,
          top: ghostTop,
          width: HANDLE_WIDTH,
          height: HANDLE_HEIGHT,
        }}
      >
        <DragHandle style={variant.handleStyle} isDragging={true} />
      </div>
    );
  };

  return (
    <div
      className="relative overflow-visible rounded-[22px] border border-[#d8dce1] bg-white p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
      ref={shellRef}
      onPointerMove={handleSurfacePointerMove}
      onPointerLeave={handleSurfacePointerLeave}
    >
      {renderDropFeedback()}
      {renderGhostFeedback()}
      <div className="overflow-hidden rounded-[18px] border border-[#d8dce1] bg-white">
        <div className="grid" style={{ gridTemplateColumns: templateColumns }}>
          {orderedColumns.map((column, index) => {
            const isTargetHeader =
              dragState &&
              variant.dropFeedbackMode === 'header-tint' &&
              index === dragState.targetIndex;
            const isTargetColumn =
              dragState &&
              variant.dropFeedbackMode === 'column-tint' &&
              index === dragState.targetIndex;
            const handleVisible = handleState?.index === index;
            const shift = getColumnShift(index);
            const isCurrentlyDragging = dragState?.fromIndex === index;

            return (
              <div
                key={column.id}
                ref={(node) => {
                  headerRefs.current[index] = node;
                }}
                className={cn(
                  'relative min-h-[58px] border-b border-r border-[#e4e7eb] bg-[#fafafa] px-3 py-3 text-[#2f3437] last:border-r-0',
                  isTargetHeader && 'bg-[#eef4ff]',
                  isTargetColumn && 'bg-[#f6f9ff]'
                )}
                style={{
                  transform: shift === 0 ? undefined : `translateX(${shift}px)`,
                  transition: 'transform 160ms ease, background-color 160ms ease',
                }}
              >
                <AnimatePresence>
                  {handleVisible && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -4 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                      type="button"
                      aria-label={`Drag ${column.label}`}
                      className={cn(
                        "absolute z-10 rounded-full border border-[#d6d9de] bg-white shadow-[0_12px_24px_-22px_rgba(15,23,42,0.26)] transition-[left,box-shadow]",
                        isCurrentlyDragging && "shadow-[0_12px_32px_-12px_rgba(37,99,235,0.3)] z-50"
                      )}
                      style={{
                        width: HANDLE_WIDTH,
                        height: HANDLE_HEIGHT,
                        left: handleState.centerX - HANDLE_WIDTH / 2,
                        top: -HANDLE_HEIGHT / 2,
                        ...getCursorStyle(variant.cursorMode),
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        clearHoverTimer();
                        clearDwellTimer();

                        if (variant.dragStartMode === 'immediate') {
                          beginDrag(event.pointerId, index, event.clientX, event.clientY);
                          return;
                        }

                        setPendingDrag({
                          pointerId: event.pointerId,
                          fromIndex: index,
                          startX: event.clientX,
                          startY: event.clientY,
                          startedAt: performance.now(),
                        });

                        if (variant.dragStartMode === 'dwell') {
                          dwellTimerRef.current = window.setTimeout(() => {
                            setPendingDrag((current) => {
                              if (
                                current == null ||
                                current.pointerId !== event.pointerId ||
                                current.fromIndex !== index
                              ) {
                                return current;
                              }
                              beginDrag(
                                current.pointerId,
                                current.fromIndex,
                                current.startX,
                                current.startY
                              );
                              return null;
                            });
                          }, 140);
                        }
                      }}
                    >
                      <DragHandle style={variant.handleStyle} isDragging={isCurrentlyDragging} />
                    </motion.button>
                  )}
                </AnimatePresence>

                {variant.revealMode === 'line-condense' && handleVisible ? (
                  <div className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-[#9aa3ad]" />
                ) : null}

                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a94a0]">
                  Column
                </div>
                <div className="mt-2 text-[13px] font-semibold tracking-[-0.02em]">
                  {column.label}
                </div>
              </div>
            );
          })}
        </div>

        {DEMO_ROWS.map((row, rowIndex) => (
          <div
            key={`${variant.id}-row-${rowIndex}`}
            className="grid"
            style={{ gridTemplateColumns: templateColumns }}
          >
            {orderedColumns.map((column, index) => {
              const isTargetColumn =
                dragState &&
                variant.dropFeedbackMode === 'column-tint' &&
                index === dragState.targetIndex;
              const shift = getColumnShift(index);

              return (
                <div
                  key={`${variant.id}-${rowIndex}-${column.id}`}
                  className={cn(
                    'min-h-[50px] border-b border-r border-[#eef1f4] bg-white px-3 py-3 text-[12px] text-[#4b5560] last:border-r-0 last:border-b-0',
                    isTargetColumn && 'bg-[#f8faff]'
                  )}
                  style={{
                    transform: shift === 0 ? undefined : `translateX(${shift}px)`,
                    transition: 'transform 160ms ease, background-color 160ms ease',
                  }}
                >
                  {row[column.id]}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TableColumnDragCard({
  variant,
}: {
  variant: TableColumnDragVariant;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.18)]',
        variant.featured && 'border-sky-200 bg-sky-50/30'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-mono font-bold text-neutral-500">
            {variant.optionNumber}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold text-neutral-900">
              {variant.name}
            </h3>
            <p className="mt-1 text-[12px] leading-5 text-neutral-500">
              {variant.description}
            </p>
          </div>
        </div>
        {variant.featured ? (
          <span className="rounded-full bg-sky-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
            Pinned
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {ACTIVATION_LABELS[variant.activationZone]}
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {REVEAL_LABELS[variant.revealMode]}
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {START_LABELS[variant.dragStartMode]}
        </span>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {DROP_LABELS[variant.dropFeedbackMode]}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(244,245,247,0.96)_48%,_rgba(235,237,240,0.92))] p-6 sm:p-7">
        <div className="mx-auto w-full max-w-[480px] rounded-[26px] border border-black/5 bg-white/88 p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.18)] sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                Interaction-led
              </div>
              <div className="mt-2 text-[15px] font-semibold tracking-[-0.03em] text-neutral-900">
                {variant.handleStyle.replace(/-/g, ' ')}
              </div>
            </div>
            <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              4 cols
            </span>
          </div>

          <div className="mt-5">
            <TableDragPreview variant={variant} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TableColumnDragLab() {
  const pinnedOptionNumbers = new Set<number>(TABLE_COLUMN_DRAG_PINNED_OPTION_NUMBERS);
  const pinnedVariants = TABLE_COLUMN_DRAG_VARIANTS.filter((variant) =>
    pinnedOptionNumbers.has(variant.optionNumber)
  );
  const exploratoryVariants = TABLE_COLUMN_DRAG_VARIANTS.filter(
    (variant) => !pinnedOptionNumbers.has(variant.optionNumber)
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 pb-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Table Drag Lab
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-neutral-950">
          30 interaction directions for a Notion-like column drag handle
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-neutral-500">
          The baseline is the same across every card: an oval handle sits on the table top
          line, and the inner stroke is aligned with that line. The variations below change
          activation zone, reveal behavior, pickup threshold, snapping logic, and drop
          feedback instead of just swapping colors.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Pinned 1 2 3
            </p>
            <p className="mt-2 text-[14px] leading-6 text-neutral-500">
              These are the three directions kept from the previous round and moved to the top.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {pinnedVariants.length} kept
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {pinnedVariants.map((variant) => (
            <TableColumnDragCard key={variant.id} variant={variant} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
              27 new interaction options
            </p>
            <p className="mt-2 text-[14px] leading-6 text-neutral-500">
              Everything below explores new interaction mechanics, not alternate colorways.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {exploratoryVariants.length} new
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {exploratoryVariants.map((variant) => (
            <TableColumnDragCard key={variant.id} variant={variant} />
          ))}
        </div>
      </div>
    </div>
  );
}
