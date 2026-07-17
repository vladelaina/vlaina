import { memo } from 'react';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  getBrushPreviewRadius,
  getStrokeWidth,
  type WhiteboardBrushTool,
  type WhiteboardPoint,
} from '../../model/whiteboardModel';
import { getStrokeDabGeometry } from '../../model/whiteboardStrokeGeometry';

interface WhiteboardBrushCursorProps {
  point: WhiteboardPoint | null;
  color: string;
  size: number;
  tool: WhiteboardBrushTool | null;
}

const brushCursorLayerClassName = 'pointer-events-none absolute inset-0 hidden overflow-visible group-hover/whiteboard-surface:block';

export const WhiteboardBrushCursor = memo(function WhiteboardBrushCursor({ color, point, size, tool }: WhiteboardBrushCursorProps) {
  if (!point || !tool) return null;
  if (tool === 'stroke-eraser') {
    return (
      <svg aria-hidden="true" className={brushCursorLayerClassName}>
        <circle
          data-whiteboard-brush-cursor="stroke-eraser"
          cx={point.x}
          cy={point.y}
          r={getBrushPreviewRadius(tool, size)}
          fill="var(--vlaina-color-whiteboard-selection-fill)"
          stroke="var(--vlaina-color-whiteboard-selected)"
          strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }
  const width = getStrokeWidth(tool, 1, size);
  const geometry = getStrokeDabGeometry(tool, width);
  const transform = geometry.angle ? `rotate(${geometry.angle} ${point.x} ${point.y})` : undefined;

  return (
    <svg aria-hidden="true" className={brushCursorLayerClassName}>
      {geometry.shape === 'rect' ? (
        <rect data-whiteboard-brush-cursor="marker" x={point.x - geometry.width / 2} y={point.y - geometry.height / 2} width={geometry.width} height={geometry.height} rx={themeWhiteboardTokens.strokeEdgeFeatherWidthPx} fill={color} opacity={themeWhiteboardTokens.brushCursorInkOpacity} stroke={color} strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx} transform={transform} vectorEffect="non-scaling-stroke" />
      ) : geometry.shape === 'ellipse' ? (
        <ellipse data-whiteboard-brush-cursor="fountain" cx={point.x} cy={point.y} rx={geometry.width / 2} ry={geometry.height / 2} fill={color} opacity={themeWhiteboardTokens.brushCursorInkOpacity} stroke={color} strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx} transform={transform} vectorEffect="non-scaling-stroke" />
      ) : (
        <circle data-whiteboard-brush-cursor={tool} cx={point.x} cy={point.y} r={getBrushPreviewRadius(tool, size)} fill={color} opacity={themeWhiteboardTokens.brushCursorInkOpacity} stroke={color} strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx} vectorEffect="non-scaling-stroke" />
      )}
      {tool === 'watercolor' ? <circle cx={point.x} cy={point.y} r={width * themeWhiteboardTokens.watercolorWashWidthScale / 2} fill={themeWhiteboardTokens.strokeNoFill} opacity={themeWhiteboardTokens.brushCursorWashGuideOpacity} stroke={color} strokeWidth={themeWhiteboardTokens.brushCursorStrokeWidthPx} /> : null}
    </svg>
  );
});
