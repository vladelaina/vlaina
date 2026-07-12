import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { isEditableTarget } from '../model/whiteboardInteractions';
import type { WhiteboardBrushTool, WhiteboardElement, WhiteboardStroke, WhiteboardTool } from '../model/whiteboardModel';
import { translateStroke } from '../model/whiteboardSelection';

interface WhiteboardKeyboardShortcutsOptions {
  active: boolean;
  elements: WhiteboardElement[];
  connectors: { id: string }[];
  pushHistory: () => void;
  resizeBrush: (tool: WhiteboardBrushTool, deltaY: number) => void;
  selectedBrushTool: WhiteboardBrushTool | null;
  selectedConnectorIds: string[];
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedConnectorIds: (ids: string[]) => void;
  setSelectedElementIds: (ids: string[]) => void;
  setSelectedStrokeIds: (ids: string[]) => void;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  setTool: (tool: WhiteboardTool) => void;
  strokes: WhiteboardStroke[];
  viewportZoom: number;
}

const TOOL_KEYS: Partial<Record<string, WhiteboardTool>> = {
  '1': 'select',
  '2': 'hand',
  '3': 'pen',
  '4': 'pencil',
  '5': 'marker',
  '6': 'eraser',
  '7': 'ruler',
  e: 'eraser',
  h: 'hand',
  m: 'marker',
  n: 'note',
  p: 'pen',
  r: 'ruler',
  v: 'select',
};

export function useWhiteboardKeyboardShortcuts({
  active,
  connectors,
  elements,
  pushHistory,
  resizeBrush,
  selectedBrushTool,
  selectedConnectorIds,
  selectedElementIds,
  selectedStrokeIds,
  setElements,
  setSelectedConnectorIds,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
  setTool,
  strokes,
  viewportZoom,
}: WhiteboardKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      const nudge = getNudge(event.key, event.shiftKey, viewportZoom);
      if (nudge && (selectedElementIds.length > 0 || selectedStrokeIds.length > 0)) {
        event.preventDefault();
        if (!event.repeat) pushHistory();
        nudgeSelection(selectedElementIds, selectedStrokeIds, setElements, setStrokes, nudge.x, nudge.y);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === 'a') {
        event.preventDefault();
        setSelectedConnectorIds(connectors.map((connector) => connector.id));
        setSelectedElementIds(elements.map((element) => element.id));
        setSelectedStrokeIds(strokes.map((stroke) => stroke.id));
        setTool('select');
        return;
      }
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const nextTool = TOOL_KEYS[key];
        if (nextTool) {
          event.preventDefault();
          setTool(nextTool);
          return;
        }
        if (selectedBrushTool && (event.key === '[' || event.key === ']')) {
          event.preventDefault();
          resizeBrush(selectedBrushTool, event.key === '[' ? 1 : -1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    active, connectors, elements, pushHistory, resizeBrush, selectedBrushTool, selectedConnectorIds,
    selectedElementIds, selectedStrokeIds, setElements, setSelectedConnectorIds, setSelectedElementIds,
    setSelectedStrokeIds, setStrokes, setTool, strokes, viewportZoom,
  ]);
}

function getNudge(key: string, large: boolean, zoom: number): { x: number; y: number } | null {
  const step = (large ? 10 : 1) / Math.max(0.01, zoom);
  if (key === 'ArrowLeft') return { x: -step, y: 0 };
  if (key === 'ArrowRight') return { x: step, y: 0 };
  if (key === 'ArrowUp') return { x: 0, y: -step };
  if (key === 'ArrowDown') return { x: 0, y: step };
  return null;
}

function nudgeSelection(
  selectedElementIds: string[],
  selectedStrokeIds: string[],
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>,
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>,
  dx: number,
  dy: number,
) {
  const elementIds = new Set(selectedElementIds);
  const strokeIds = new Set(selectedStrokeIds);
  if (elementIds.size > 0) setElements((current) => current.map((element) => (elementIds.has(element.id) ? { ...element, x: element.x + dx, y: element.y + dy } : element)));
  if (strokeIds.size > 0) setStrokes((current) => current.map((stroke) => (strokeIds.has(stroke.id) ? translateStroke(stroke, dx, dy) : stroke)));
}
