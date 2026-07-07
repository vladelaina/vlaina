import { useCallback, useState } from 'react';
import {
  WHITEBOARD_DEFAULT_BRUSH_COLORS,
  WHITEBOARD_DEFAULT_BRUSH_SIZES,
  resizeBrushSize,
  type WhiteboardBrushColors,
  type WhiteboardBrushSizes,
  type WhiteboardBrushTool,
  type WhiteboardDrawingTool,
} from '../model/whiteboardModel';

export function useWhiteboardBrushSizes() {
  const [brushColors, setBrushColors] = useState<WhiteboardBrushColors>(WHITEBOARD_DEFAULT_BRUSH_COLORS);
  const [brushSizes, setBrushSizes] = useState<WhiteboardBrushSizes>(WHITEBOARD_DEFAULT_BRUSH_SIZES);

  const resizeBrush = useCallback((tool: WhiteboardBrushTool, deltaY: number) => {
    setBrushSizes((current) => ({
      ...current,
      [tool]: resizeBrushSize(current[tool], deltaY),
    }));
  }, []);

  const setBrushColor = useCallback((tool: WhiteboardDrawingTool, color: string) => {
    setBrushColors((current) => ({ ...current, [tool]: color }));
  }, []);

  return { brushColors, brushSizes, resizeBrush, setBrushColor };
}
