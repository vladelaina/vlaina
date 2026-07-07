import { memo, useMemo } from 'react';
import { WHITEBOARD_BRUSHES, getStrokeWidth, type WhiteboardStroke } from '../model/whiteboardModel';
import { getCenterStrokePath, getPressureStrokePath, getStrokeRenderWidth } from '../model/whiteboardStrokeGeometry';
import { themeWhiteboardTokens } from '@/styles/themeTokens';

interface WhiteboardStrokeLayerProps {
  strokes: WhiteboardStroke[];
}

export const WhiteboardStrokeLayer = memo(function WhiteboardStrokeLayer({ strokes }: WhiteboardStrokeLayerProps) {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <g>
        {strokes.map((stroke) => <WhiteboardStrokeNode key={stroke.id} stroke={stroke} />)}
      </g>
    </svg>
  );
});

export const WhiteboardDraftStrokeLayer = memo(function WhiteboardDraftStrokeLayer({ stroke }: { stroke: WhiteboardStroke | null }) {
  if (!stroke || stroke.points.length === 0) return null;
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      <WhiteboardStrokeNode stroke={stroke} />
    </svg>
  );
});

const WhiteboardStrokeNode = memo(function WhiteboardStrokeNode({ stroke }: { stroke: WhiteboardStroke }) {
  const brush = WHITEBOARD_BRUSHES[stroke.tool];
  const color = stroke.color || brush.color;
  const renderWidth = useMemo(() => getStrokeRenderWidth(stroke), [stroke]);
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    return <circle cx={point.x} cy={point.y} fill={color} opacity={brush.opacity} r={renderWidth / 2} />;
  }
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  if (stroke.tool === 'watercolor') {
    const centerPath = getCenterStrokePath(stroke);
    return (
      <g>
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorOuterWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.watercolorInnerOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorInnerWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'crayon') {
    const centerPath = getCenterStrokePath(stroke);
    const pressurePath = getPressureStrokePath(stroke);
    return (
      <g>
        <path d={pressurePath} fill={color} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.crayonTextureOpacityScale} stroke={color} strokeDasharray={themeWhiteboardTokens.crayonTextureDashArray} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.crayonTextureWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'fountain') {
    const centerPath = getCenterStrokePath(stroke);
    const pressurePath = getPressureStrokePath(stroke);
    return (
      <g>
        <path d={pressurePath} fill={color} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={themeWhiteboardTokens.fountainHighlightOpacity} stroke={themeWhiteboardTokens.fountainHighlightColor} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.fountainHighlightWidthScale} />
      </g>
    );
  }
  return (
    <g opacity={brush.opacity}>
      <path d={getPressureStrokePath(stroke)} fill={color} />
      <circle cx={first.x} cy={first.y} fill={color} r={getStrokeWidth(stroke.tool, first.pressure, stroke.size) / 2} />
      <circle cx={last.x} cy={last.y} fill={color} r={getStrokeWidth(stroke.tool, last.pressure, stroke.size) / 2} />
    </g>
  );
});
