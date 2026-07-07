import { memo, useMemo, type CSSProperties, type PointerEvent } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { WhiteboardBrushCursor } from './WhiteboardBrushCursor';
import { WhiteboardElementNode } from './WhiteboardElementNode';
import { WhiteboardSelectionOverlay } from './WhiteboardSelectionOverlay';
import { WhiteboardRulerOverlay } from './WhiteboardRulerOverlay';
import { WhiteboardDraftStrokeLayer, WhiteboardStrokeLayer } from './WhiteboardStrokeLayer';
import {
  getWhiteboardElementCenter,
  type WhiteboardBrushTool,
  type WhiteboardConnector,
  type WhiteboardElement,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';
import { getElementBounds, getStrokeBounds, rectsOverlap, type WhiteboardResizeHandle, type WhiteboardSelectionRect } from '../model/whiteboardSelection';
import { getVisibleBoardRect } from '../model/whiteboardViewport';
import type { WhiteboardRulerState } from '../hooks/useWhiteboardRuler';

interface WhiteboardCanvasLayerProps {
  brushCursorColor: string;
  brushCursorPoint: WhiteboardPoint | null;
  brushCursorSize: number;
  brushCursorTool: WhiteboardBrushTool | null;
  connectorSourceId: string | null;
  connectors: WhiteboardConnector[];
  draftStroke: WhiteboardStroke | null;
  elementTextLabel: string;
  elements: WhiteboardElement[];
  resizeLabel: string;
  ruler: WhiteboardRulerState;
  rulerCloseLabel: string;
  rulerRotateLabel: string;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  selectionRect: WhiteboardSelectionRect | null;
  strokes: WhiteboardStroke[];
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  viewportSize: WhiteboardPoint;
  onConnectorTarget: (id: string) => void;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
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
  draftStroke,
  elementTextLabel,
  elements,
  resizeLabel,
  ruler,
  rulerCloseLabel,
  rulerRotateLabel,
  selectedElementIds,
  selectedStrokeIds,
  selectionRect,
  strokes,
  tool,
  viewport,
  viewportSize,
  onConnectorTarget,
  onElementPointerDown,
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

  return (
    <div className="absolute inset-0 overflow-visible" style={transformedLayerStyle}>
      <WhiteboardContentLayer
        connectorSourceId={connectorSourceId}
        connectors={connectors}
        elementTextLabel={elementTextLabel}
        elements={elements}
        resizeLabel={resizeLabel}
        ruler={ruler}
        rulerCloseLabel={rulerCloseLabel}
        rulerRotateLabel={rulerRotateLabel}
        selectedElementIds={selectedElementIds}
        selectedStrokeIds={selectedStrokeIds}
        selectionRect={selectionRect}
        strokes={strokes}
        tool={tool}
        visibleRect={visibleRect}
        viewportZoom={viewport.zoom}
        onConnectorTarget={onConnectorTarget}
        onElementPointerDown={onElementPointerDown}
        onElementTextChange={onElementTextChange}
        onResizePointerDown={onResizePointerDown}
        onRulerClose={onRulerClose}
        onRulerPointerDown={onRulerPointerDown}
        onSelectElement={onSelectElement}
        onSelectionResizePointerDown={onSelectionResizePointerDown}
      />
      <WhiteboardDraftStrokeLayer stroke={draftStroke} />
      <WhiteboardBrushCursor color={brushCursorColor} point={brushCursorPoint} size={brushCursorSize} tool={brushCursorTool} />
    </div>
  );
}

interface ConnectorLine extends WhiteboardConnector {
  from: WhiteboardPoint;
  to: WhiteboardPoint;
}

const WhiteboardContentLayer = memo(function WhiteboardContentLayer({
  connectorSourceId,
  connectors,
  elementTextLabel,
  elements,
  resizeLabel,
  ruler,
  rulerCloseLabel,
  rulerRotateLabel,
  selectedElementIds,
  selectedStrokeIds,
  selectionRect,
  strokes,
  tool,
  visibleRect,
  viewportZoom,
  onConnectorTarget,
  onElementPointerDown,
  onElementTextChange,
  onResizePointerDown,
  onRulerClose,
  onRulerPointerDown,
  onSelectElement,
  onSelectionResizePointerDown,
}: Omit<WhiteboardCanvasLayerProps, 'brushCursorColor' | 'brushCursorPoint' | 'brushCursorSize' | 'brushCursorTool' | 'draftStroke' | 'viewport' | 'viewportSize'> & {
  visibleRect: WhiteboardSelectionRect | null;
  viewportZoom: number;
}) {
  const selectedElementIdSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);
  const selectedStrokeIdSet = useMemo(() => new Set(selectedStrokeIds), [selectedStrokeIds]);
  const elementsById = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);
  const visibleElements = useMemo(() => elements.filter((element) => (
    selectedElementIdSet.has(element.id) || !visibleRect || rectsOverlap(getElementBounds(element), visibleRect)
  )), [elements, selectedElementIdSet, visibleRect]);
  const visibleStrokes = useMemo(() => strokes.filter((stroke) => {
    if (stroke.points.length === 0 || selectedStrokeIdSet.has(stroke.id)) return selectedStrokeIdSet.has(stroke.id);
    const bounds = getStrokeBounds(stroke);
    return !visibleRect || (bounds ? rectsOverlap(bounds, visibleRect) : false);
  }), [selectedStrokeIdSet, strokes, visibleRect]);
  const connectorLines = useMemo(() => connectors.flatMap((connector) => {
    const from = elementsById.get(connector.fromId);
    const to = elementsById.get(connector.toId);
    if (!from || !to) return [];
    const line = { ...connector, from: getWhiteboardElementCenter(from), to: getWhiteboardElementCenter(to) };
    return isConnectorVisible(line, visibleRect, selectedElementIdSet) ? [line] : [];
  }), [connectors, elementsById, selectedElementIdSet, visibleRect]);
  const selectedItemCount = selectedElementIds.length + selectedStrokeIds.length;

  return (
    <>
      <WhiteboardStrokeLayer strokes={visibleStrokes} />
      <WhiteboardSelectionOverlay
        elements={elements}
        selectedElementIds={selectedElementIds}
        selectedStrokeIds={selectedStrokeIds}
        selectionRect={selectionRect}
        strokes={strokes}
        onSelectionResizePointerDown={onSelectionResizePointerDown}
      />
      <WhiteboardRulerOverlay
        ruler={ruler}
        closeLabel={rulerCloseLabel}
        rotateLabel={rulerRotateLabel}
        zoom={viewportZoom}
        onClose={onRulerClose}
        onPointerDown={onRulerPointerDown}
      />
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
        {connectorLines.map((line) => (
          <line
            key={line.id}
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke="var(--vlaina-color-whiteboard-connector)"
            strokeLinecap="round"
            strokeWidth={themeWhiteboardTokens.connectorStrokeWidthPx}
          />
        ))}
      </svg>
      {visibleElements.map((element) => (
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
          onResizePointerDown={onResizePointerDown}
          onSelect={onSelectElement}
          onTextChange={onElementTextChange}
        />
      ))}
    </>
  );
});

function isConnectorVisible(
  line: ConnectorLine,
  visibleRect: WhiteboardSelectionRect | null,
  selectedElementIdSet: Set<string>,
): boolean {
  if (!visibleRect || selectedElementIdSet.has(line.fromId) || selectedElementIdSet.has(line.toId)) return true;
  const bounds = {
    height: Math.abs(line.to.y - line.from.y),
    width: Math.abs(line.to.x - line.from.x),
    x: Math.min(line.from.x, line.to.x),
    y: Math.min(line.from.y, line.to.y),
  };
  return rectsOverlap(bounds, visibleRect);
}
