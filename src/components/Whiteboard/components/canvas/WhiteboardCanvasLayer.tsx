import { memo, useMemo, type CSSProperties, type PointerEvent } from 'react';
import { WhiteboardBrushCursor } from './WhiteboardBrushCursor';
import { WhiteboardElementNode } from './WhiteboardElementNode';
import { WhiteboardEraserTrail } from './WhiteboardEraserTrail';
import { WhiteboardSelectionOverlay } from './WhiteboardSelectionOverlay';
import { WhiteboardDraftStrokeLayer, WhiteboardStrokeLayer } from './WhiteboardStrokeLayer';
import type {
  WhiteboardBrushTool,
  WhiteboardElement,
  WhiteboardPoint,
  WhiteboardStroke,
  WhiteboardTool,
  WhiteboardViewport,
} from '../../model/whiteboardModel';
import {
  getElementBounds,
  getStrokeBounds,
  rectsOverlap,
  type WhiteboardLassoPath,
  type WhiteboardResizeHandle,
  type WhiteboardSelectionRect,
} from '../../model/whiteboardSelection';
import { getVisibleBoardRect } from '../../model/whiteboardViewport';
import type { WhiteboardMovePreview } from '../../model/whiteboardInteractions';
import type { WhiteboardEraserPreview } from '../../model/whiteboardEraser';

const EMPTY_IDS: string[] = [];

interface WhiteboardCanvasLayerProps {
  brushCursorColor: string;
  brushCursorPoint: WhiteboardPoint | null;
  brushCursorSize: number;
  brushCursorTool: WhiteboardBrushTool | null;
  draftStroke: WhiteboardStroke | null;
  elements: WhiteboardElement[];
  eraserPreview: WhiteboardEraserPreview;
  movePreview: WhiteboardMovePreview | null;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  selectionPath: WhiteboardLassoPath | null;
  strokes: WhiteboardStroke[];
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  viewportSize: WhiteboardPoint;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onSelectionResizePointerDown: (event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => void;
}

export function WhiteboardCanvasLayer(props: WhiteboardCanvasLayerProps) {
  const style: CSSProperties = {
    transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`,
    transformOrigin: '0 0',
  };
  const visibleRect = useMemo(
    () => getVisibleBoardRect(props.viewport, props.viewportSize),
    [props.viewport, props.viewportSize],
  );

  return (
    <div className="absolute inset-0 overflow-visible" style={style}>
      <WhiteboardContentLayer
        elements={props.elements}
        eraserPreview={props.eraserPreview}
        movePreview={props.movePreview}
        selectedElementIds={props.selectedElementIds}
        selectedStrokeIds={props.selectedStrokeIds}
        selectionPath={props.selectionPath}
        strokes={props.strokes}
        tool={props.tool}
        visibleRect={visibleRect}
        onElementPointerDown={props.onElementPointerDown}
        onSelectionResizePointerDown={props.onSelectionResizePointerDown}
      />
      <WhiteboardEraserTrail trail={props.eraserPreview.trail} zoom={props.viewport.zoom} />
      <WhiteboardDraftStrokeLayer stroke={props.draftStroke} />
      <WhiteboardBrushCursor
        color={props.brushCursorColor}
        point={props.brushCursorPoint}
        size={props.brushCursorSize}
        tool={props.brushCursorTool}
      />
    </div>
  );
}

interface WhiteboardContentLayerProps {
  elements: WhiteboardElement[];
  eraserPreview: WhiteboardEraserPreview;
  movePreview: WhiteboardMovePreview | null;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  selectionPath: WhiteboardLassoPath | null;
  strokes: WhiteboardStroke[];
  tool: WhiteboardTool;
  visibleRect: WhiteboardSelectionRect | null;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onSelectionResizePointerDown: (event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => void;
}

const WhiteboardContentLayer = memo(function WhiteboardContentLayer({
  elements,
  eraserPreview,
  movePreview,
  selectedElementIds,
  selectedStrokeIds,
  selectionPath,
  strokes,
  tool,
  visibleRect,
  onElementPointerDown,
  onSelectionResizePointerDown,
}: WhiteboardContentLayerProps) {
  const selectedElementIdSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);
  const selectedStrokeIdSet = useMemo(() => new Set(selectedStrokeIds), [selectedStrokeIds]);
  const erasingElementIdSet = useMemo(() => new Set(eraserPreview.elementIds), [eraserPreview.elementIds]);
  const movingElementIdSet = useMemo(() => new Set(movePreview?.elementIds ?? EMPTY_IDS), [movePreview?.elementIds]);
  const movingStrokeIdSet = useMemo(() => new Set(movePreview?.strokeIds ?? EMPTY_IDS), [movePreview?.strokeIds]);
  const visibleElements = useMemo(() => elements.filter((element) => (
    selectedElementIdSet.has(element.id) || !visibleRect || rectsOverlap(getElementBounds(element), visibleRect)
  )), [elements, selectedElementIdSet, visibleRect]);
  const visibleStrokes = useMemo(() => strokes.filter((stroke) => {
    if (stroke.points.length === 0 || selectedStrokeIdSet.has(stroke.id)) return selectedStrokeIdSet.has(stroke.id);
    const bounds = getStrokeBounds(stroke);
    return !visibleRect || (bounds ? rectsOverlap(bounds, visibleRect) : false);
  }), [selectedStrokeIdSet, strokes, visibleRect]);
  const staticStrokes = useMemo(
    () => visibleStrokes.filter((stroke) => !movingStrokeIdSet.has(stroke.id)),
    [movingStrokeIdSet, visibleStrokes],
  );
  const movingStrokes = useMemo(
    () => visibleStrokes.filter((stroke) => movingStrokeIdSet.has(stroke.id)),
    [movingStrokeIdSet, visibleStrokes],
  );
  const staticElements = useMemo(
    () => visibleElements.filter((element) => !movingElementIdSet.has(element.id)),
    [movingElementIdSet, visibleElements],
  );
  const movingElements = useMemo(
    () => visibleElements.filter((element) => movingElementIdSet.has(element.id)),
    [movingElementIdSet, visibleElements],
  );
  const transform = movePreview ? `translate(${movePreview.dx}px, ${movePreview.dy}px)` : undefined;
  const selectedItemCount = selectedElementIds.length + selectedStrokeIds.length;
  const elementProps = { erasingElementIdSet, onElementPointerDown, selectedElementIds, selectedItemCount, tool };

  return (
    <>
      <WhiteboardElementList {...elementProps} elements={staticElements} moving={false} />
      <WhiteboardElementList {...elementProps} elements={movingElements} moving transform={transform} />
      <WhiteboardStrokeLayer erasingStrokeIds={eraserPreview.strokeIds} strokes={staticStrokes} />
      {movingStrokes.length > 0 ? <WhiteboardStrokeLayer cssTransform={transform} erasingStrokeIds={eraserPreview.strokeIds} strokes={movingStrokes} /> : null}
      {tool === 'select' ? (
        <WhiteboardSelectionOverlay elements={elements} movePreview={movePreview} selectedElementIds={selectedElementIds} selectedStrokeIds={selectedStrokeIds} selectionPath={selectionPath} strokes={strokes} onSelectionResizePointerDown={onSelectionResizePointerDown} />
      ) : null}
    </>
  );
});

interface WhiteboardElementListProps {
  elements: WhiteboardElement[];
  erasingElementIdSet: Set<string>;
  selectedElementIds: string[];
  selectedItemCount: number;
  tool: WhiteboardTool;
  moving: boolean;
  transform?: string;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
}

const WhiteboardElementList = memo(function WhiteboardElementList(props: WhiteboardElementListProps) {
  const nodes = props.elements.map((element) => (
    <WhiteboardElementNode
      key={element.id}
      element={element}
      erasing={props.erasingElementIdSet.has(element.id)}
      moving={props.moving}
      selected={props.tool === 'select' && props.selectedElementIds.includes(element.id)}
      showSelectionBorder={props.tool === 'select' && props.selectedItemCount <= 1 && props.selectedElementIds.includes(element.id)}
      tool={props.tool}
      onPointerDown={props.onElementPointerDown}
    />
  ));
  return props.transform ? <div className="absolute inset-0 overflow-visible" style={{ transform: props.transform }}>{nodes}</div> : nodes;
});
