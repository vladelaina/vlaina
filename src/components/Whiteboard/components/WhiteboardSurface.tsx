import { useLayoutEffect, useState, type DragEvent, type MouseEvent, type PointerEvent, type RefObject, type WheelEvent } from 'react';
import { cn } from '@/lib/utils';
import { WhiteboardCanvasLayer } from './WhiteboardCanvasLayer';
import {
  isDrawingTool,
  type WhiteboardBrushTool,
  type WhiteboardConnector,
  type WhiteboardElement,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';
import type { WhiteboardSelectionRect } from '../model/whiteboardSelection';
import type { WhiteboardResizeHandle } from '../model/whiteboardSelection';
import type { WhiteboardRulerState } from '../hooks/useWhiteboardRuler';

interface WhiteboardSurfaceProps {
  brushCursorColor: string;
  brushCursorPoint: WhiteboardPoint | null;
  brushCursorSize: number;
  brushCursorTool: WhiteboardBrushTool | null;
  connectorSourceId: string | null;
  connectors: WhiteboardConnector[];
  draftStroke: WhiteboardStroke | null;
  elementTextLabel: string;
  elements: WhiteboardElement[];
  isPanning: boolean;
  resizeLabel: string;
  ruler: WhiteboardRulerState;
  rulerCloseLabel: string;
  rulerRotateLabel: string;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  selectionRect: WhiteboardSelectionRect | null;
  spacePressed: boolean;
  strokes: WhiteboardStroke[];
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  viewportRef: RefObject<HTMLDivElement | null>;
  onConnectorTarget: (id: string) => void;
  onElementPointerDown: (event: PointerEvent<HTMLDivElement>, element: WhiteboardElement) => void;
  onElementTextChange: (id: string, text: string) => void;
  onImageDrop: (file: File, point: WhiteboardPoint) => void;
  onDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (event: PointerEvent<HTMLButtonElement>, element: WhiteboardElement) => void;
  onRulerClose: () => void;
  onRulerPointerDown: (event: PointerEvent<HTMLDivElement | HTMLButtonElement>, mode: 'move' | 'rotate') => void;
  onSelectElement: (id: string) => void;
  onSelectionResizePointerDown: (event: PointerEvent<SVGRectElement>, handle: WhiteboardResizeHandle) => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
}

export function WhiteboardSurface({
  brushCursorColor,
  brushCursorPoint,
  brushCursorSize,
  brushCursorTool,
  connectorSourceId,
  connectors,
  draftStroke,
  elementTextLabel,
  elements,
  isPanning,
  resizeLabel,
  ruler,
  rulerCloseLabel,
  rulerRotateLabel,
  selectedElementIds,
  selectedStrokeIds,
  selectionRect,
  spacePressed,
  strokes,
  tool,
  viewport,
  viewportRef,
  onConnectorTarget,
  onElementPointerDown,
  onElementTextChange,
  onImageDrop,
  onDoubleClick,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onPointerUp,
  onResizePointerDown,
  onRulerClose,
  onRulerPointerDown,
  onSelectElement,
  onSelectionResizePointerDown,
  onWheel,
}: WhiteboardSurfaceProps) {
  const [imageDragActive, setImageDragActive] = useState(false);
  const [viewportSize, setViewportSize] = useState<WhiteboardPoint>({ x: 0, y: 0 });
  const cursorClass = cn(
    'relative h-full overflow-hidden touch-none',
    isPanning && 'cursor-grabbing',
    !isPanning && (tool === 'hand' || spacePressed) && 'cursor-grab',
    !isPanning && isDrawingTool(tool) && 'cursor-crosshair',
    !isPanning && tool === 'eraser' && 'cursor-cell',
    !isPanning && tool !== 'hand' && !spacePressed && !isDrawingTool(tool) && tool !== 'eraser' && 'cursor-default',
  );
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasImageFile(event.dataTransfer)) return;
    event.preventDefault();
    setImageDragActive(true);
    event.dataTransfer.dropEffect = 'copy';
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    setImageDragActive(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const imageFile = getFirstImageFile(event.dataTransfer);
    if (!imageFile) return;
    event.preventDefault();
    setImageDragActive(false);
    onImageDrop(imageFile, { x: event.clientX, y: event.clientY });
  };
  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const updateSize = () => setViewportSize((current) => {
      const next = { x: node.clientWidth, y: node.clientHeight };
      return current.x === next.x && current.y === next.y ? current : next;
    });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [viewportRef]);

  return (
    <div
      ref={viewportRef}
      className={cursorClass}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onWheel={onWheel}
    >
      <WhiteboardCanvasLayer
        brushCursorColor={brushCursorColor}
        brushCursorPoint={brushCursorPoint}
        brushCursorSize={brushCursorSize}
        brushCursorTool={brushCursorTool}
        connectorSourceId={connectorSourceId}
        connectors={connectors}
        draftStroke={draftStroke}
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
        viewport={viewport}
        viewportSize={viewportSize}
        onConnectorTarget={onConnectorTarget}
        onElementPointerDown={onElementPointerDown}
        onElementTextChange={onElementTextChange}
        onResizePointerDown={onResizePointerDown}
        onRulerClose={onRulerClose}
        onRulerPointerDown={onRulerPointerDown}
        onSelectElement={onSelectElement}
        onSelectionResizePointerDown={onSelectionResizePointerDown}
      />
      {imageDragActive ? (
        <div className="pointer-events-none absolute inset-4 rounded-[var(--vlaina-radius-8px)] border border-[var(--vlaina-color-whiteboard-selected)] bg-[var(--vlaina-color-whiteboard-selection-fill)] shadow-[var(--vlaina-shadow-toolbar)]" />
      ) : null}
    </div>
  );
}

function hasImageFile(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items).some((item) => item.kind === 'file' && item.type.startsWith('image/'));
}

function getFirstImageFile(dataTransfer: DataTransfer): File | null {
  return Array.from(dataTransfer.files).find((file) => file.type.startsWith('image/')) ?? null;
}
