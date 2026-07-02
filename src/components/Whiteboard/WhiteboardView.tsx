import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useI18n } from '@/lib/i18n';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { WhiteboardElementNode } from './components/WhiteboardElementNode';
import { WhiteboardToolbar } from './components/WhiteboardToolbar';
import {
  WHITEBOARD_INITIAL_VIEWPORT,
  WHITEBOARD_SEED_CONNECTORS,
  WHITEBOARD_SEED_ELEMENTS,
  clampWhiteboardZoom,
  createWhiteboardElement,
  getWhiteboardElementCenter,
  resizeWhiteboardElement,
  type WhiteboardConnector,
  type WhiteboardElement,
  type WhiteboardPoint,
  type WhiteboardTool,
  type WhiteboardViewport,
} from './model/whiteboardModel';

interface WhiteboardViewProps {
  active?: boolean;
  onPrimaryContentReady?: () => void;
  onStartupReady?: () => void;
}

type DragState =
  | {
    kind: 'move';
    id: string;
    offsetX: number;
    offsetY: number;
  }
  | {
    kind: 'resize';
    id: string;
    startPoint: WhiteboardPoint;
    startWidth: number;
    startHeight: number;
  }
  | {
    kind: 'pan';
    startClientX: number;
    startClientY: number;
    startViewport: WhiteboardViewport;
  };

function nextElementIndex(elements: WhiteboardElement[]) {
  return elements.length + 1;
}

export function WhiteboardView({
  active = true,
  onPrimaryContentReady,
  onStartupReady,
}: WhiteboardViewProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [tool, setTool] = useState<WhiteboardTool>('select');
  const [viewport, setViewport] = useState(WHITEBOARD_INITIAL_VIEWPORT);
  const [elements, setElements] = useState<WhiteboardElement[]>(WHITEBOARD_SEED_ELEMENTS);
  const [connectors, setConnectors] = useState<WhiteboardConnector[]>(WHITEBOARD_SEED_CONNECTORS);
  const [selectedElementId, setSelectedElementId] = useState<string | null>('wb-note-1');
  const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onStartupReady?.();
    onPrimaryContentReady?.();
  }, [onPrimaryContentReady, onStartupReady]);

  const elementsById = useMemo(() => new Map(elements.map((element) => [element.id, element])), [elements]);

  const getBoardPoint = useCallback((event: PointerEvent): WhiteboardPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - viewport.x) / viewport.zoom,
      y: (event.clientY - rect.top - viewport.y) / viewport.zoom,
    };
  }, [viewport]);

  const handleConnectorTarget = useCallback((id: string) => {
    setSelectedElementId(id);
    setConnectorSourceId((sourceId) => {
      if (!sourceId) return id;
      if (sourceId === id) return null;
      setConnectors((current) => [
        ...current,
        { id: `wb-connector-${current.length + 1}`, fromId: sourceId, toId: id },
      ]);
      return null;
    });
  }, []);

  const handleViewportPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const point = getBoardPoint(event);

    if (tool === 'select') {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedElementId(null);
      setDragState({
        kind: 'pan',
        startClientX: event.clientX,
        startClientY: event.clientY,
        startViewport: viewport,
      });
      return;
    }

    if (tool === 'connector') {
      setConnectorSourceId(null);
      return;
    }

    const nextElement = createWhiteboardElement(tool, point, nextElementIndex(elements));
    setElements((current) => [...current, nextElement]);
    setSelectedElementId(nextElement.id);
    setTool('select');
  }, [elements, getBoardPoint, tool, viewport]);

  const handleElementPointerDown = useCallback((event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => {
    event.stopPropagation();
    if (tool === 'connector') return;
    if (tool !== 'select' || event.button !== 0) return;
    const point = getBoardPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    setDragState({
      kind: 'move',
      id: element.id,
      offsetX: point.x - element.x,
      offsetY: point.y - element.y,
    });
  }, [getBoardPoint, tool]);

  const handleResizePointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => {
    event.stopPropagation();
    const point = getBoardPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    setDragState({
      kind: 'resize',
      id: element.id,
      startPoint: point,
      startWidth: element.width,
      startHeight: element.height,
    });
  }, [getBoardPoint]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!dragState) return;

    if (dragState.kind === 'pan') {
      setViewport({
        ...dragState.startViewport,
        x: dragState.startViewport.x + event.clientX - dragState.startClientX,
        y: dragState.startViewport.y + event.clientY - dragState.startClientY,
      });
      return;
    }

    const point = getBoardPoint(event);
    setElements((current) => current.map((element) => {
      if (element.id !== dragState.id) return element;
      if (dragState.kind === 'move') {
        return {
          ...element,
          x: Math.round(point.x - dragState.offsetX),
          y: Math.round(point.y - dragState.offsetY),
        };
      }
      return resizeWhiteboardElement(
        element,
        dragState.startWidth + point.x - dragState.startPoint.x,
        dragState.startHeight + point.y - dragState.startPoint.y,
      );
    }));
  }, [dragState, getBoardPoint]);

  const connectorLines = connectors.flatMap((connector) => {
    const from = elementsById.get(connector.fromId);
    const to = elementsById.get(connector.toId);
    if (!from || !to) return [];
    return [{ ...connector, from: getWhiteboardElementCenter(from), to: getWhiteboardElementCenter(to) }];
  });

  const updateZoom = (delta: number) => {
    setViewport((current) => ({ ...current, zoom: clampWhiteboardZoom(current.zoom + delta) }));
  };
  const gridSize = themeWhiteboardTokens.gridSizePx * viewport.zoom;
  const gridStrongSize = themeWhiteboardTokens.gridStrongSizePx * viewport.zoom;
  const gridBackgroundSize = [
    `${gridSize}px ${gridSize}px`,
    `${gridSize}px ${gridSize}px`,
    `${gridStrongSize}px ${gridStrongSize}px`,
    `${gridStrongSize}px ${gridStrongSize}px`,
  ].join(', ');

  return (
    <section
      aria-label={t('app.viewWhiteboard')}
      data-whiteboard-active={active ? 'true' : 'false'}
      className="relative h-full min-h-0 overflow-hidden bg-[var(--vlaina-color-whiteboard-canvas)] text-[var(--vlaina-color-text-primary)]"
    >
      <WhiteboardToolbar
        tool={tool}
        viewport={viewport}
        onToolChange={setTool}
        onZoomChange={updateZoom}
        onResetView={() => setViewport(WHITEBOARD_INITIAL_VIEWPORT)}
        onClear={() => {
          setElements([]);
          setConnectors([]);
          setSelectedElementId(null);
          setConnectorSourceId(null);
        }}
      />

      <div
        ref={viewportRef}
        className="h-full cursor-grab overflow-hidden active:cursor-grabbing"
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragState(null)}
        onPointerCancel={() => setDragState(null)}
        style={{
          backgroundImage: `
            linear-gradient(var(--vlaina-color-whiteboard-grid) var(--vlaina-size-1px), transparent var(--vlaina-size-1px)),
            linear-gradient(90deg, var(--vlaina-color-whiteboard-grid) var(--vlaina-size-1px), transparent var(--vlaina-size-1px)),
            linear-gradient(var(--vlaina-color-whiteboard-grid-strong) var(--vlaina-size-1px), transparent var(--vlaina-size-1px)),
            linear-gradient(90deg, var(--vlaina-color-whiteboard-grid-strong) var(--vlaina-size-1px), transparent var(--vlaina-size-1px))
          `,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: gridBackgroundSize,
        }}
      >
        <div
          className="relative"
          style={{
            height: themeWhiteboardTokens.stageHeightPx,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            width: themeWhiteboardTokens.stageWidthPx,
          }}
        >
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-visible"
            height={themeWhiteboardTokens.stageHeightPx}
            width={themeWhiteboardTokens.stageWidthPx}
          >
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
          {elements.map((element) => (
            <WhiteboardElementNode
              key={element.id}
              connectorSource={connectorSourceId === element.id}
              element={element}
              elementTextLabel={t('whiteboard.elementText')}
              resizeLabel={t('whiteboard.resizeElement')}
              selected={selectedElementId === element.id}
              tool={tool}
              onConnectorTarget={handleConnectorTarget}
              onPointerDown={handleElementPointerDown}
              onResizePointerDown={handleResizePointerDown}
              onSelect={setSelectedElementId}
              onTextChange={(id, text) => {
                setElements((current) => current.map((item) => (
                  item.id === id ? { ...item, text } : item
                )));
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
