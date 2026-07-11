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
  if (tool === 'eraser') return <WhiteboardEraserCursor point={point} size={size} />;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <circle
        cx={point.x}
        cy={point.y}
        r={getBrushPreviewRadius(tool, size)}
        fill={color}
        opacity="var(--vlaina-opacity-20)"
        stroke="var(--vlaina-color-whiteboard-selected)"
        strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
});

function WhiteboardEraserCursor({ point, size }: { point: WhiteboardPoint; size: number }) {
  const radius = getBrushPreviewRadius('eraser', size);
  const width = radius * themeWhiteboardTokens.eraserCursorRubberWidthScale;
  const height = radius * themeWhiteboardTokens.eraserCursorRubberHeightScale;
  const x = point.x - width / 2;
  const y = point.y - height / 2;

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <circle
        cx={point.x}
        cy={point.y}
        r={radius}
        fill="var(--vlaina-color-whiteboard-selection-fill)"
        opacity={themeWhiteboardTokens.eraserCursorGuideOpacity}
        stroke="var(--vlaina-color-whiteboard-selected)"
        strokeDasharray="4 4"
        strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
        vectorEffect="non-scaling-stroke"
      />
      <g
        transform={`rotate(${themeWhiteboardTokens.eraserCursorRubberAngleDeg} ${point.x} ${point.y})`}
        shapeRendering="geometricPrecision"
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={themeWhiteboardTokens.eraserCursorRubberRadiusPx}
          fill="var(--vlaina-color-floating-surface)"
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={x + width * 0.28}
          y1={y}
          x2={x + width * 0.28}
          y2={y + height}
          opacity={themeWhiteboardTokens.eraserCursorBandOpacity}
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
