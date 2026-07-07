import { memo } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  getBrushPreviewRadius,
  type WhiteboardBrushTool,
  type WhiteboardPoint,
} from '../model/whiteboardModel';

interface WhiteboardBrushCursorProps {
  point: WhiteboardPoint | null;
  color: string;
  size: number;
  tool: WhiteboardBrushTool | null;
}

export const WhiteboardBrushCursor = memo(function WhiteboardBrushCursor({ color, point, size, tool }: WhiteboardBrushCursorProps) {
  if (!point || !tool) return null;
  const fill = tool === 'eraser' ? 'transparent' : color;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <circle
        cx={point.x}
        cy={point.y}
        r={getBrushPreviewRadius(tool, size)}
        fill={fill}
        opacity={tool === 'eraser' ? undefined : 'var(--vlaina-opacity-20)'}
        stroke="var(--vlaina-color-whiteboard-selected)"
        strokeDasharray={tool === 'eraser' ? '4 4' : undefined}
        strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});
