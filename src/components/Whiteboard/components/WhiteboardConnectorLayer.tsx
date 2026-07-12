import { memo, useMemo, type PointerEvent } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardPoint } from '../model/whiteboardModel';
import { getWhiteboardConnectorEndpoints, getWhiteboardElementBoundaryPoint } from '../model/whiteboardConnectorGeometry';
import { rectsOverlap, type WhiteboardSelectionRect } from '../model/whiteboardSelection';
import type { WhiteboardMovePreview } from '../model/whiteboardInteractions';

interface ConnectorLine extends WhiteboardConnector {
  from: WhiteboardPoint;
  to: WhiteboardPoint;
}

interface WhiteboardConnectorLayerProps {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  interactive: boolean;
  movePreview: WhiteboardMovePreview | null;
  onSelectConnector: (id: string, additive: boolean) => void;
  selectedConnectorIds: string[];
  selectedElementIds: string[];
  visibleRect: WhiteboardSelectionRect | null;
}

export const WhiteboardConnectorLayer = memo(function WhiteboardConnectorLayer({
  connectors,
  elements,
  interactive,
  movePreview,
  onSelectConnector,
  selectedConnectorIds,
  selectedElementIds,
  visibleRect,
}: WhiteboardConnectorLayerProps) {
  const elementsById = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);
  const movingElementIdSet = useMemo(() => new Set(movePreview?.elementIds ?? []), [movePreview?.elementIds]);
  const selectedConnectorIdSet = useMemo(() => new Set(selectedConnectorIds), [selectedConnectorIds]);
  const selectedElementIdSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);
  const connectorLines = useMemo(() => connectors.flatMap((connector) => {
    const from = elementsById.get(connector.fromId);
    const to = elementsById.get(connector.toId);
    if (!from || !to) return [];
    const endpoints = getWhiteboardConnectorEndpoints(
      offsetMovingElement(from, movingElementIdSet, movePreview),
      offsetMovingElement(to, movingElementIdSet, movePreview),
    );
    const line = { ...connector, ...endpoints };
    return isConnectorVisible(line, visibleRect, selectedElementIdSet) ? [line] : [];
  }), [connectors, elementsById, movePreview, movingElementIdSet, selectedElementIdSet, visibleRect]);

  return (
    <svg
      aria-hidden="true"
      className={`absolute inset-0 size-full overflow-visible ${interactive ? '' : 'pointer-events-none'}`}
      height="100%"
      width="100%"
    >
      <ConnectorArrowMarker id="whiteboard-connector-arrow" fill="var(--vlaina-color-whiteboard-connector)" />
      <ConnectorArrowMarker id="whiteboard-connector-selected-arrow" fill="var(--vlaina-color-whiteboard-selected)" />
      {connectorLines.map((line) => {
        const selected = selectedConnectorIdSet.has(line.id);
        return (
          <g key={line.id} data-whiteboard-connector={line.id}>
            <line
              x1={line.from.x}
              y1={line.from.y}
              x2={line.to.x}
              y2={line.to.y}
              stroke={selected ? 'var(--vlaina-color-whiteboard-selected)' : 'var(--vlaina-color-whiteboard-connector)'}
              strokeLinecap="round"
              strokeWidth={selected ? themeWhiteboardTokens.connectorSelectedStrokeWidthPx : themeWhiteboardTokens.connectorStrokeWidthPx}
              markerEnd={selected ? 'url(#whiteboard-connector-selected-arrow)' : 'url(#whiteboard-connector-arrow)'}
              pointerEvents="none"
            />
            <ConnectorHitTarget interactive={interactive} line={line} onSelectConnector={onSelectConnector} />
          </g>
        );
      })}
    </svg>
  );
});

export function WhiteboardConnectorPreview({ cursorPoint, source }: {
  cursorPoint: WhiteboardPoint | null;
  source: WhiteboardElement | null;
}) {
  const start = source && cursorPoint ? getWhiteboardElementBoundaryPoint(source, cursorPoint) : null;
  if (!start || !cursorPoint) return null;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" height="100%" width="100%">
      <ConnectorArrowMarker id="whiteboard-connector-preview-arrow" fill="var(--vlaina-color-whiteboard-connector)" />
      <line
        x1={start.x}
        y1={start.y}
        x2={cursorPoint.x}
        y2={cursorPoint.y}
        stroke="var(--vlaina-color-whiteboard-connector)"
        strokeDasharray={themeWhiteboardTokens.connectorPreviewDashArray}
        strokeLinecap="round"
        strokeWidth={themeWhiteboardTokens.connectorStrokeWidthPx}
        markerEnd="url(#whiteboard-connector-preview-arrow)"
      />
    </svg>
  );
}

function ConnectorHitTarget({
  interactive,
  line,
  onSelectConnector,
}: {
  interactive: boolean;
  line: ConnectorLine;
  onSelectConnector: (id: string, additive: boolean) => void;
}) {
  const handlePointerDown = (event: PointerEvent<SVGLineElement>) => {
    if (!interactive || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectConnector(line.id, event.shiftKey);
  };

  return (
    <line
      x1={line.from.x}
      y1={line.from.y}
      x2={line.to.x}
      y2={line.to.y}
      stroke="transparent"
      strokeLinecap="round"
      strokeWidth={themeWhiteboardTokens.connectorHitWidthPx}
      pointerEvents={interactive ? 'stroke' : 'none'}
      className={interactive ? 'cursor-pointer' : undefined}
      onPointerDown={handlePointerDown}
    />
  );
}

function ConnectorArrowMarker({ fill, id }: { fill: string; id: string }) {
  return (
    <defs>
      <marker
        id={id}
        markerHeight={themeWhiteboardTokens.connectorArrowHeightPx}
        markerUnits="userSpaceOnUse"
        markerWidth={themeWhiteboardTokens.connectorArrowWidthPx}
        orient="auto"
        refX={themeWhiteboardTokens.connectorArrowWidthPx}
        refY={themeWhiteboardTokens.connectorArrowHeightPx / 2}
        viewBox={`0 0 ${themeWhiteboardTokens.connectorArrowWidthPx} ${themeWhiteboardTokens.connectorArrowHeightPx}`}
      >
        <path
          d={`M 0 0 L ${themeWhiteboardTokens.connectorArrowWidthPx} ${themeWhiteboardTokens.connectorArrowHeightPx / 2} L 0 ${themeWhiteboardTokens.connectorArrowHeightPx} z`}
          fill={fill}
        />
      </marker>
    </defs>
  );
}

function isConnectorVisible(
  line: ConnectorLine,
  visibleRect: WhiteboardSelectionRect | null,
  selectedElementIdSet: Set<string>,
): boolean {
  if (!visibleRect || selectedElementIdSet.has(line.fromId) || selectedElementIdSet.has(line.toId)) return true;
  return rectsOverlap({
    height: Math.abs(line.to.y - line.from.y),
    width: Math.abs(line.to.x - line.from.x),
    x: Math.min(line.from.x, line.to.x),
    y: Math.min(line.from.y, line.to.y),
  }, visibleRect);
}

function offsetMovingElement(
  element: WhiteboardElement,
  movingIds: Set<string>,
  movePreview: WhiteboardMovePreview | null,
): WhiteboardElement {
  return movePreview && movingIds.has(element.id)
    ? { ...element, x: element.x + movePreview.dx, y: element.y + movePreview.dy }
    : element;
}
