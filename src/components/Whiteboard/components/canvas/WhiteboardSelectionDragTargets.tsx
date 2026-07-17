import { themeIconTokens, themeWhiteboardTokens } from '@/styles/themeTokens';
import type { WhiteboardMovePreview } from '../../model/whiteboardInteractions';
import type { WhiteboardStroke } from '../../model/whiteboardModel';
import { getCenterStrokePath, getStrokeRenderWidth } from '../../model/whiteboardStrokeRenderGeometry';

interface WhiteboardSelectionDragTargetsProps {
  movePreview: WhiteboardMovePreview | null;
  movingStrokeIds: Set<string>;
  strokes: WhiteboardStroke[];
}

export function WhiteboardSelectionDragTargets({
  movePreview,
  movingStrokeIds,
  strokes,
}: WhiteboardSelectionDragTargetsProps) {
  const cursor = movePreview ? 'grabbing' : 'grab';
  return strokes.map((stroke) => {
    const transform = movingStrokeIds.has(stroke.id) && movePreview
      ? `translate(${movePreview.dx} ${movePreview.dy})`
      : undefined;
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      return (
        <circle
          key={stroke.id}
          data-whiteboard-selection-drag-target={stroke.id}
          className="pointer-events-auto"
          cx={point.x}
          cy={point.y}
          r={themeWhiteboardTokens.selectionResizeEdgeHitSizePx / 2}
          fill="transparent"
          style={{ cursor }}
          transform={transform}
        />
      );
    }
    return (
      <path
        key={stroke.id}
        data-whiteboard-selection-drag-target={stroke.id}
        d={getCenterStrokePath(stroke)}
        fill={themeIconTokens.fillNone}
        pointerEvents="stroke"
        stroke="transparent"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={Math.max(getStrokeRenderWidth(stroke), themeWhiteboardTokens.selectionResizeEdgeHitSizePx)}
        style={{ cursor }}
        transform={transform}
        vectorEffect="non-scaling-stroke"
      />
    );
  });
}
