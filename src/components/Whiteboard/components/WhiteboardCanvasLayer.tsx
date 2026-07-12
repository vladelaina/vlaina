import { memo, useMemo, type CSSProperties, type PointerEvent } from 'react';
import { WhiteboardBrushCursor } from './WhiteboardBrushCursor';
import { WhiteboardConnectorLayer, WhiteboardConnectorPreview } from './WhiteboardConnectorLayer';
import { WhiteboardElementNode } from './WhiteboardElementNode';
import { WhiteboardElementPreview } from './WhiteboardElementPreview';
import { WhiteboardSelectionOverlay } from './WhiteboardSelectionOverlay';
import { WhiteboardRulerOverlay } from './WhiteboardRulerOverlay';
import { WhiteboardDraftStrokeLayer, WhiteboardStrokeLayer } from './WhiteboardStrokeLayer';
import {
  type WhiteboardBrushTool,
  type WhiteboardConnector,
  type WhiteboardElement,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';
import { getElementBounds, getStrokeBounds, rectsOverlap, type WhiteboardLassoPath, type WhiteboardResizeHandle, type WhiteboardSelectionRect } from '../model/whiteboardSelection';
import { getVisibleBoardRect } from '../model/whiteboardViewport';
import type { WhiteboardRulerState } from '../hooks/useWhiteboardRuler';
import type { WhiteboardMovePreview } from '../model/whiteboardInteractions';

const EMPTY_MOVING_IDS: string[] = [];

interface WhiteboardCanvasLayerProps {
  brushCursorColor: string;
  brushCursorPoint: WhiteboardPoint | null;
  brushCursorSize: number;
  brushCursorTool: WhiteboardBrushTool | null;
  connectorSourceId: string | null;
  connectors: WhiteboardConnector[];
  draftElement: WhiteboardElement | null;
  draftStroke: WhiteboardStroke | null;
  elementTextLabel: string;
  elements: WhiteboardElement[];
  movePreview: WhiteboardMovePreview | null;
  resizeLabel: string;
  ruler: WhiteboardRulerState;
  rulerCloseLabel: string;
  rulerRotateLabel: string;
  selectedConnectorIds: string[];
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  selectionPath: WhiteboardLassoPath | null;
  selectionRect: WhiteboardSelectionRect | null;
  strokes: WhiteboardStroke[];
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  viewportSize: WhiteboardPoint;
  onConnectorTarget: (id: string) => void;
  onSelectConnector: (id: string, additive: boolean) => void;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onElementTextEditEnd: (id: string) => void;
  onElementTextEditStart: (id: string) => void;
  onElementTextChange: (id: string, text: string) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => void;
  onRulerClose: () => void;
  onRulerPointerDown: (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, mode: 'move' | 'rotate') => void;
  onSelectElement: (id: string) => void;
  onSelectionResizePointerDown: (event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => void;
}

export function WhiteboardCanvasLayer({
  brushCursorColor,
  brushCursorPoint,
  brushCursorSize,
  brushCursorTool,
  connectorSourceId,
  connectors,
  draftElement,
  draftStroke,
  elementTextLabel,
  elements,
  movePreview,
  resizeLabel,
  ruler,
  rulerCloseLabel,
  rulerRotateLabel,
  selectedConnectorIds,
  selectedElementIds,
  selectedStrokeIds,
  selectionPath,
  selectionRect,
  strokes,
  tool,
  viewport,
  viewportSize,
  onConnectorTarget,
  onSelectConnector,
  onElementPointerDown,
  onElementTextEditEnd,
  onElementTextEditStart,
  onElementTextChange,
  onResizePointerDown,
  onRulerClose,
  onRulerPointerDown,
  onSelectElement,
  onSelectionResizePointerDown,
}: WhiteboardCanvasLayerProps) {
  const transformedLayerStyle: CSSProperties = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    transformOrigin: '0 0',
  };
  const visibleRect = useMemo(() => getVisibleBoardRect(viewport, viewportSize), [viewport, viewportSize]);
  const connectorPreviewSource = tool === 'connector' && connectorSourceId
    ? elements.find((element) => element.id === connectorSourceId) ?? null
    : null;

  return (
    <div className="absolute inset-0 overflow-visible" style={transformedLayerStyle}>
      <WhiteboardContentLayer
        connectorSourceId={connectorSourceId}
        connectors={connectors}
        elementTextLabel={elementTextLabel}
        elements={elements}
        movePreview={movePreview}
        resizeLabel={resizeLabel}
        ruler={ruler}
        rulerCloseLabel={rulerCloseLabel}
        rulerRotateLabel={rulerRotateLabel}
        selectedConnectorIds={selectedConnectorIds}
        selectedElementIds={selectedElementIds}
        selectedStrokeIds={selectedStrokeIds}
        selectionPath={selectionPath}
        selectionRect={selectionRect}
        strokes={strokes}
        tool={tool}
        visibleRect={visibleRect}
        viewportZoom={viewport.zoom}
        onConnectorTarget={onConnectorTarget}
        onSelectConnector={onSelectConnector}
        onElementPointerDown={onElementPointerDown}
        onElementTextEditEnd={onElementTextEditEnd}
        onElementTextEditStart={onElementTextEditStart}
        onElementTextChange={onElementTextChange}
        onResizePointerDown={onResizePointerDown}
        onRulerClose={onRulerClose}
        onRulerPointerDown={onRulerPointerDown}
        onSelectElement={onSelectElement}
        onSelectionResizePointerDown={onSelectionResizePointerDown}
      />
      {draftElement ? <WhiteboardElementPreview element={draftElement} /> : null}
      <WhiteboardConnectorPreview cursorPoint={brushCursorPoint} source={connectorPreviewSource} />
      <WhiteboardDraftStrokeLayer stroke={draftStroke} />
      <WhiteboardBrushCursor color={brushCursorColor} point={brushCursorPoint} size={brushCursorSize} tool={brushCursorTool} />
    </div>
  );
}

const WhiteboardContentLayer = memo(function WhiteboardContentLayer({
  connectorSourceId,
  connectors,
  elementTextLabel,
  elements,
  movePreview,
  resizeLabel,
  ruler,
  rulerCloseLabel,
  rulerRotateLabel,
  selectedConnectorIds,
  selectedElementIds,
  selectedStrokeIds,
  selectionPath,
  selectionRect,
  strokes,
  tool,
  visibleRect,
  viewportZoom,
  onConnectorTarget,
  onSelectConnector,
  onElementPointerDown,
  onElementTextEditEnd,
  onElementTextEditStart,
  onElementTextChange,
  onResizePointerDown,
  onRulerClose,
  onRulerPointerDown,
  onSelectElement,
  onSelectionResizePointerDown,
}: Omit<WhiteboardCanvasLayerProps, 'brushCursorColor' | 'brushCursorPoint' | 'brushCursorSize' | 'brushCursorTool' | 'draftElement' | 'draftStroke' | 'viewport' | 'viewportSize'> & {
  visibleRect: WhiteboardSelectionRect | null;
  viewportZoom: number;
}) {
  const selectedElementIdSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);
  const selectedStrokeIdSet = useMemo(() => new Set(selectedStrokeIds), [selectedStrokeIds]);
  const movingElementIds = movePreview?.elementIds ?? EMPTY_MOVING_IDS;
  const movingStrokeIds = movePreview?.strokeIds ?? EMPTY_MOVING_IDS;
  const movingElementIdSet = useMemo(() => new Set<string>(movingElementIds), [movingElementIds]);
  const movingStrokeIdSet = useMemo(() => new Set<string>(movingStrokeIds), [movingStrokeIds]);
  const visibleElements = useMemo(() => elements.filter((element) => (
    selectedElementIdSet.has(element.id) || !visibleRect || rectsOverlap(getElementBounds(element), visibleRect)
  )), [elements, selectedElementIdSet, visibleRect]);
  const visibleStrokes = useMemo(() => strokes.filter((stroke) => {
    if (stroke.points.length === 0 || selectedStrokeIdSet.has(stroke.id)) return selectedStrokeIdSet.has(stroke.id);
    const bounds = getStrokeBounds(stroke);
    return !visibleRect || (bounds ? rectsOverlap(bounds, visibleRect) : false);
  }), [selectedStrokeIdSet, strokes, visibleRect]);
  const staticVisibleStrokes = useMemo(() => visibleStrokes.filter((stroke) => !movingStrokeIdSet.has(stroke.id)), [movingStrokeIdSet, visibleStrokes]);
  const movingVisibleStrokes = useMemo(() => visibleStrokes.filter((stroke) => movingStrokeIdSet.has(stroke.id)), [movingStrokeIdSet, visibleStrokes]);
  const staticVisibleElements = useMemo(() => visibleElements.filter((element) => !movingElementIdSet.has(element.id)), [movingElementIdSet, visibleElements]);
  const movingVisibleElements = useMemo(() => visibleElements.filter((element) => movingElementIdSet.has(element.id)), [movingElementIdSet, visibleElements]);
  const moveCssTransform = movePreview ? `translate(${movePreview.dx}px, ${movePreview.dy}px)` : undefined;
  const selectedItemCount = selectedConnectorIds.length + selectedElementIds.length + selectedStrokeIds.length;

  return (
    <>
      <WhiteboardStrokeLayer strokes={staticVisibleStrokes} />
      {movingVisibleStrokes.length > 0 ? <WhiteboardStrokeLayer cssTransform={moveCssTransform} strokes={movingVisibleStrokes} /> : null}
      <WhiteboardSelectionOverlay
        elements={elements}
        movePreview={movePreview}
        selectedElementIds={selectedElementIds}
        selectedStrokeIds={selectedStrokeIds}
        selectionPath={selectionPath}
        selectionRect={selectionRect}
        strokes={strokes}
        onSelectionResizePointerDown={onSelectionResizePointerDown}
      />
      <WhiteboardRulerOverlay
        ruler={ruler}
        closeLabel={rulerCloseLabel}
        interactive={tool === 'ruler'}
        rotateLabel={rulerRotateLabel}
        zoom={viewportZoom}
        onClose={onRulerClose}
        onPointerDown={onRulerPointerDown}
      />
      <WhiteboardConnectorLayer
        connectors={connectors}
        elements={elements}
        interactive={tool === 'select'}
        movePreview={movePreview}
        selectedConnectorIds={selectedConnectorIds}
        selectedElementIds={selectedElementIds}
        visibleRect={visibleRect}
        onSelectConnector={onSelectConnector}
      />
      <WhiteboardElementList connectorSourceId={connectorSourceId} elementTextLabel={elementTextLabel} elements={staticVisibleElements} resizeLabel={resizeLabel} selectedElementIds={selectedElementIds} selectedItemCount={selectedItemCount} tool={tool} onConnectorTarget={onConnectorTarget} onElementPointerDown={onElementPointerDown} onElementTextEditEnd={onElementTextEditEnd} onElementTextEditStart={onElementTextEditStart} onElementTextChange={onElementTextChange} onResizePointerDown={onResizePointerDown} onSelectElement={onSelectElement} />
      <WhiteboardElementList connectorSourceId={connectorSourceId} elementTextLabel={elementTextLabel} elements={movingVisibleElements} resizeLabel={resizeLabel} selectedElementIds={selectedElementIds} selectedItemCount={selectedItemCount} tool={tool} transform={moveCssTransform} onConnectorTarget={onConnectorTarget} onElementPointerDown={onElementPointerDown} onElementTextEditEnd={onElementTextEditEnd} onElementTextEditStart={onElementTextEditStart} onElementTextChange={onElementTextChange} onResizePointerDown={onResizePointerDown} onSelectElement={onSelectElement} />
    </>
  );
});

const WhiteboardElementList = memo(function WhiteboardElementList({
  connectorSourceId, elementTextLabel, elements, resizeLabel, selectedElementIds, selectedItemCount,
  tool, transform, onConnectorTarget, onElementPointerDown, onElementTextEditEnd, onElementTextEditStart, onElementTextChange, onResizePointerDown, onSelectElement,
}: {
  connectorSourceId: string | null; elementTextLabel: string; elements: WhiteboardElement[]; resizeLabel: string;
  selectedElementIds: string[]; selectedItemCount: number; tool: WhiteboardTool; transform?: string;
  onConnectorTarget: (id: string) => void;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onElementTextEditEnd: (id: string) => void;
  onElementTextEditStart: (id: string) => void;
  onElementTextChange: (id: string, text: string) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => void;
  onSelectElement: (id: string) => void;
}) {
  const nodes = useMemo(() => elements.map((element) => (
    <WhiteboardElementNode
      key={element.id}
      connectorSource={connectorSourceId === element.id}
      element={element}
      elementTextLabel={elementTextLabel}
      resizeLabel={resizeLabel}
      selected={selectedItemCount <= 1 && selectedElementIds.includes(element.id)}
      tool={tool}
      onConnectorTarget={onConnectorTarget}
      onPointerDown={onElementPointerDown}
      onTextEditEnd={onElementTextEditEnd}
      onTextEditStart={onElementTextEditStart}
      onResizePointerDown={onResizePointerDown}
      onSelect={onSelectElement}
      onTextChange={onElementTextChange}
    />
  )), [
    connectorSourceId, elementTextLabel, elements, onConnectorTarget, onElementPointerDown, onElementTextEditEnd, onElementTextEditStart, onElementTextChange,
    onResizePointerDown, onSelectElement, resizeLabel, selectedElementIds, selectedItemCount, tool,
  ]);
  return transform ? <div className="absolute inset-0 overflow-visible" style={{ transform }}>{nodes}</div> : nodes;
});
