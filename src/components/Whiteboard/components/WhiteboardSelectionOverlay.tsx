import { memo, useMemo, type PointerEvent } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  getBoundsUnion,
  getElementBounds,
  getElementsInRect,
  getStrokeBounds,
  getStrokesInRect,
  type WhiteboardResizeHandle,
  type WhiteboardSelectionRect,
} from '../model/whiteboardSelection';
import type { WhiteboardElement, WhiteboardStroke } from '../model/whiteboardModel';
import type { WhiteboardMovePreview } from '../model/whiteboardInteractions';

const EMPTY_MOVING_IDS: string[] = [];

interface WhiteboardSelectionOverlayProps {
  elements: WhiteboardElement[];
  movePreview: WhiteboardMovePreview | null;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  selectionRect: WhiteboardSelectionRect | null;
  strokes: WhiteboardStroke[];
  onSelectionResizePointerDown: (event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => void;
}

export const WhiteboardSelectionOverlay = memo(function WhiteboardSelectionOverlay({
  elements,
  movePreview,
  selectedElementIds,
  selectedStrokeIds,
  selectionRect,
  strokes,
  onSelectionResizePointerDown,
}: WhiteboardSelectionOverlayProps) {
  const elementById = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);
  const strokeById = useMemo(() => new Map(strokes.map((stroke) => [stroke.id, stroke])), [strokes]);
  const movingElementIds = movePreview?.elementIds ?? EMPTY_MOVING_IDS;
  const movingStrokeIds = movePreview?.strokeIds ?? EMPTY_MOVING_IDS;
  const movingStrokeIdSet = useMemo(() => new Set(movingStrokeIds), [movingStrokeIds]);
  const movingIdSet = useMemo(() => new Set([...movingElementIds, ...movingStrokeIds]), [movingElementIds, movingStrokeIds]);
  const baseSelectedStrokeBounds = useMemo(() => selectedStrokeIds.flatMap((id) => {
    const stroke = strokeById.get(id);
    if (!stroke) return [];
    const bounds = getStrokeBounds(stroke);
    return bounds ? [{ ...bounds, id: stroke.id }] : [];
  }), [selectedStrokeIds, strokeById]);
  const baseSelectedElementBounds = useMemo(() => selectedElementIds.flatMap((id) => {
    const element = elementById.get(id);
    return element ? [{ ...getElementBounds(element), id: element.id }] : [];
  }), [elementById, selectedElementIds]);
  const baseSelectedBounds = useMemo(() => [...baseSelectedElementBounds, ...baseSelectedStrokeBounds], [baseSelectedElementBounds, baseSelectedStrokeBounds]);
  const baseGroupBounds = useMemo(() => (baseSelectedBounds.length > 1 ? getBoundsUnion(baseSelectedBounds) : null), [baseSelectedBounds]);
  const groupBounds = baseGroupBounds ? offsetRect(baseGroupBounds, movePreview) : null;
  const strokeBounds = useMemo(() => (
    groupBounds ? [] : baseSelectedStrokeBounds.map((bounds) => offsetMovingRect(bounds, bounds.id, movingStrokeIdSet, movePreview))
  ), [baseSelectedStrokeBounds, groupBounds, movePreview, movingStrokeIdSet]);
  const singleBounds = baseSelectedBounds.length === 1
    ? offsetMovingRect(baseSelectedBounds[0], baseSelectedBounds[0].id, movingIdSet, movePreview)
    : null;
  const resizeBounds = !selectionRect && baseSelectedBounds.length > 0 ? groupBounds ?? singleBounds : null;
  const preview = useMemo(() => getMarqueePreview(elements, strokes, selectionRect), [elements, selectionRect, strokes]);

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {selectionRect ? (
        <rect
          x={selectionRect.x}
          y={selectionRect.y}
          width={selectionRect.width}
          height={selectionRect.height}
          fill="var(--vlaina-color-whiteboard-selection-fill)"
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {strokeBounds.map((bounds) => (
        <rect
          key={bounds.id}
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="transparent"
          rx="6"
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeDasharray="6 5"
          strokeWidth={themeWhiteboardTokens.strokeSelectionWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {groupBounds ? (
        <rect
          x={groupBounds.x}
          y={groupBounds.y}
          width={groupBounds.width}
          height={groupBounds.height}
          fill="transparent"
          rx={themeWhiteboardTokens.exportElementRadiusPx}
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeDasharray="6 5"
          strokeWidth={themeWhiteboardTokens.strokeSelectionWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {preview.itemBounds.map((bounds) => (
        <rect
          key={bounds.id}
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          fill="transparent"
          rx="6"
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeDasharray="6 5"
          strokeWidth={themeWhiteboardTokens.strokeSelectionWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {preview.groupBounds ? (
        <rect
          x={preview.groupBounds.x}
          y={preview.groupBounds.y}
          width={preview.groupBounds.width}
          height={preview.groupBounds.height}
          fill="transparent"
          rx={themeWhiteboardTokens.exportElementRadiusPx}
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeDasharray="6 5"
          strokeWidth={themeWhiteboardTokens.strokeSelectionWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {resizeBounds ? (
        <SelectionResizeHandles bounds={resizeBounds} onPointerDown={onSelectionResizePointerDown} />
      ) : null}
    </svg>
  );
});

function SelectionResizeHandles({
  bounds,
  onPointerDown,
}: {
  bounds: WhiteboardSelectionRect;
  onPointerDown: (event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => void;
}) {
  const edge = themeWhiteboardTokens.selectionResizeEdgeHitSizePx;
  const size = themeWhiteboardTokens.selectionResizeHandleSizePx;
  const halfEdge = edge / 2;
  const halfSize = size / 2;
  const edgeHandles: Array<{ cursor: string; handle: WhiteboardResizeHandle; rect: WhiteboardSelectionRect }> = [
    { cursor: 'ns-resize', handle: 'n', rect: { height: edge, width: bounds.width, x: bounds.x, y: bounds.y - halfEdge } },
    { cursor: 'ew-resize', handle: 'e', rect: { height: bounds.height, width: edge, x: bounds.x + bounds.width - halfEdge, y: bounds.y } },
    { cursor: 'ns-resize', handle: 's', rect: { height: edge, width: bounds.width, x: bounds.x, y: bounds.y + bounds.height - halfEdge } },
    { cursor: 'ew-resize', handle: 'w', rect: { height: bounds.height, width: edge, x: bounds.x - halfEdge, y: bounds.y } },
  ];
  const cornerHandles: Array<{ cursor: string; handle: WhiteboardResizeHandle; x: number; y: number }> = [
    { cursor: 'nwse-resize', handle: 'nw', x: bounds.x, y: bounds.y },
    { cursor: 'nesw-resize', handle: 'ne', x: bounds.x + bounds.width, y: bounds.y },
    { cursor: 'nwse-resize', handle: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { cursor: 'nesw-resize', handle: 'sw', x: bounds.x, y: bounds.y + bounds.height },
  ];

  return (
    <g>
      {edgeHandles.map(({ cursor, handle, rect }) => (
        <rect
          key={handle}
          className="pointer-events-auto"
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          fill="transparent"
          style={{ cursor }}
          onPointerDown={(event) => onPointerDown(event, handle)}
        />
      ))}
      {cornerHandles.map(({ cursor, handle, x, y }) => (
        <rect
          key={handle}
          className="pointer-events-auto"
          x={x - halfSize}
          y={y - halfSize}
          width={size}
          height={size}
          fill="var(--vlaina-color-floating-surface)"
          rx={themeWhiteboardTokens.brushCursorStrokeWidthPx}
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeWidth={themeWhiteboardTokens.strokeSelectionWidthPx}
          style={{ cursor }}
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) => onPointerDown(event, handle)}
        />
      ))}
    </g>
  );
}

function offsetMovingRect<T extends WhiteboardSelectionRect>(
  rect: T,
  id: string,
  movingIds: Set<string>,
  movePreview: WhiteboardMovePreview | null,
): T {
  return movePreview && movingIds.has(id) ? { ...rect, x: rect.x + movePreview.dx, y: rect.y + movePreview.dy } : rect;
}

function offsetRect<T extends WhiteboardSelectionRect>(rect: T, movePreview: WhiteboardMovePreview | null): T {
  return movePreview ? { ...rect, x: rect.x + movePreview.dx, y: rect.y + movePreview.dy } : rect;
}

function getMarqueePreview(
  elements: WhiteboardElement[],
  strokes: WhiteboardStroke[],
  rect: WhiteboardSelectionRect | null,
): { groupBounds: WhiteboardSelectionRect | null; itemBounds: Array<WhiteboardSelectionRect & { id: string }> } {
  if (!rect || (rect.width < 3 && rect.height < 3)) return { groupBounds: null, itemBounds: [] };
  const elementIds = new Set(getElementsInRect(elements, rect));
  const strokeIds = new Set(getStrokesInRect(strokes, rect));
  const elementBounds = elements.flatMap((element) => (
    elementIds.has(element.id) ? [{ ...getElementBounds(element), id: element.id }] : []
  ));
  const strokeBounds = strokes.flatMap((stroke) => {
    if (!strokeIds.has(stroke.id)) return [];
    const bounds = getStrokeBounds(stroke);
    return bounds ? [{ ...bounds, id: stroke.id }] : [];
  });
  const bounds = [...elementBounds, ...strokeBounds];
  return bounds.length > 1
    ? { groupBounds: getBoundsUnion(bounds), itemBounds: [] }
    : { groupBounds: null, itemBounds: bounds };
}
