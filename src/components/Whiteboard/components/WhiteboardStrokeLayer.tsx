import { memo, useMemo } from 'react';
import { WHITEBOARD_BRUSHES, getStrokeWidth, type WhiteboardStroke } from '../model/whiteboardModel';
import { getPressureStrokePath, getStrokeRenderGeometry, getStrokeRenderWidth } from '../model/whiteboardStrokeGeometry';
import { themeWhiteboardTokens } from '@/styles/themeTokens';

interface WhiteboardStrokeLayerProps {
  cssTransform?: string;
  strokes: WhiteboardStroke[];
}

export const WhiteboardStrokeLayer = memo(function WhiteboardStrokeLayer({ cssTransform, strokes }: WhiteboardStrokeLayerProps) {
  const strokeNodes = useMemo(() => strokes.map((stroke) => <WhiteboardStrokeNode key={stroke.id} stroke={stroke} />), [strokes]);
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" style={cssTransform ? { transform: cssTransform, transformOrigin: '0 0', willChange: 'transform' } : undefined}>
      <g>
        {strokeNodes}
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
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    const renderWidth = getStrokeRenderWidth(stroke);
    return <circle cx={point.x} cy={point.y} fill={color} opacity={brush.opacity} r={renderWidth / 2} />;
  }
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  if (stroke.tool === 'watercolor') {
    const { centerPath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g shapeRendering="geometricPrecision">
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.watercolorWashOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorWashWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorOuterWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.watercolorInnerOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorInnerWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'pencil') {
    const { centerPath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <StrokeCaps color={color} first={first} last={last} opacity={brush.opacity} stroke={stroke} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.pencilGrainOpacityScale} stroke={color} strokeDasharray={themeWhiteboardTokens.pencilGrainDashArray} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={Math.max(themeWhiteboardTokens.strokeEdgeFeatherWidthPx, renderWidth * themeWhiteboardTokens.pencilGrainWidthScale)} />
      </g>
    );
  }
  if (stroke.tool === 'marker') {
    const { centerPath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <StrokeCaps color={color} first={first} last={last} opacity={brush.opacity} stroke={stroke} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.markerCoreOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.markerCoreWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'crayon') {
    const { centerPath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.crayonTextureOpacityScale} stroke={color} strokeDasharray={themeWhiteboardTokens.crayonTextureDashArray} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.crayonTextureWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.crayonWaxOpacityScale} stroke={color} strokeDasharray={themeWhiteboardTokens.crayonWaxDashArray} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={Math.max(themeWhiteboardTokens.strokeEdgeFeatherWidthPx, renderWidth * themeWhiteboardTokens.crayonWaxWidthScale)} />
      </g>
    );
  }
  if (stroke.tool === 'fountain') {
    const { centerPath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <StrokeCaps color={color} first={first} last={last} opacity={brush.opacity} stroke={stroke} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={themeWhiteboardTokens.fountainHighlightOpacity} stroke={themeWhiteboardTokens.fountainHighlightColor} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.fountainHighlightWidthScale} />
      </g>
    );
  }
  return (
    <g opacity={brush.opacity} shapeRendering="geometricPrecision">
      <PressureStrokePath color={color} d={getPressureStrokePath(stroke)} />
      <StrokeCaps color={color} first={first} last={last} stroke={stroke} />
    </g>
  );
});

function PressureStrokePath({
  color,
  d,
  opacity,
}: {
  color: string;
  d: string;
  opacity?: number;
}) {
  return (
    <path
      d={d}
      fill={color}
      opacity={opacity}
      stroke={color}
      strokeLinejoin={themeWhiteboardTokens.strokeLineJoin}
      strokeWidth={themeWhiteboardTokens.strokeEdgeFeatherWidthPx}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function StrokeCaps({
  color,
  first,
  last,
  opacity,
  stroke,
}: {
  color: string;
  first: WhiteboardStroke['points'][number];
  last: WhiteboardStroke['points'][number];
  opacity?: number;
  stroke: WhiteboardStroke;
}) {
  return (
    <>
      <circle cx={first.x} cy={first.y} fill={color} opacity={opacity} r={getStrokeWidth(stroke.tool, first.pressure, stroke.size) / 2} />
      <circle cx={last.x} cy={last.y} fill={color} opacity={opacity} r={getStrokeWidth(stroke.tool, last.pressure, stroke.size) / 2} />
    </>
  );
}
