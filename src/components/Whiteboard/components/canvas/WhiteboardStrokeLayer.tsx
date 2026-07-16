import { memo, useMemo } from 'react';
import { WHITEBOARD_BRUSHES, type WhiteboardStroke } from '../../model/whiteboardModel';
import { getPressureStrokePath, getStrokeDabGeometry, getStrokeRenderGeometry, getStrokeRenderWidth } from '../../model/whiteboardStrokeGeometry';
import { getWhiteboardStrokeDashStyle } from '../../model/whiteboardStrokeTexture';
import { themeWhiteboardTokens } from '@/styles/themeTokens';

interface WhiteboardStrokeLayerProps {
  cssTransform?: string;
  erasingStrokeIds?: string[];
  strokes: WhiteboardStroke[];
}

export const WhiteboardStrokeLayer = memo(function WhiteboardStrokeLayer({ cssTransform, erasingStrokeIds = [], strokes }: WhiteboardStrokeLayerProps) {
  const erasingStrokeIdSet = useMemo(() => new Set(erasingStrokeIds), [erasingStrokeIds]);
  const strokeNodes = useMemo(() => strokes.map((stroke) => (
    <g key={stroke.id} data-whiteboard-stroke={stroke.id} opacity={erasingStrokeIdSet.has(stroke.id) ? themeWhiteboardTokens.eraserTargetPreviewOpacity : undefined}>
      <WhiteboardStrokeNode stroke={stroke} />
    </g>
  )), [erasingStrokeIdSet, strokes]);
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
    return <WhiteboardStrokeDab color={color} opacity={brush.opacity} point={point} stroke={stroke} width={renderWidth} />;
  }
  if (stroke.tool === 'watercolor') {
    const { centerPath, heavyPressurePath, mediumPressurePath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g data-whiteboard-brush="watercolor" shapeRendering="geometricPrecision">
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.watercolorWashOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorWashWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.watercolorOuterWidthScale} />
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity * themeWhiteboardTokens.watercolorInnerOpacityScale} />
        <PressureDetailPaths color={color} heavyPath={heavyPressurePath} mediumPath={mediumPressurePath} opacity={brush.opacity * themeWhiteboardTokens.watercolorPressureCoreOpacityScale} width={renderWidth * themeWhiteboardTokens.watercolorPressureCoreWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'pencil') {
    const { centerPath, heavyPressurePath, mediumPressurePath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    const primaryTexture = getWhiteboardStrokeDashStyle(stroke, themeWhiteboardTokens.pencilGrainDashArray, 0, 10);
    const secondaryTexture = getWhiteboardStrokeDashStyle(stroke, themeWhiteboardTokens.pencilGrainSecondaryDashArray, themeWhiteboardTokens.pencilGrainDashOffsetPx, 11);
    return (
      <g data-whiteboard-brush="pencil" shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.pencilGrainOpacityScale} stroke={color} strokeDasharray={primaryTexture.dashArray} strokeDashoffset={primaryTexture.dashOffset} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={Math.max(themeWhiteboardTokens.strokeEdgeFeatherWidthPx, renderWidth * themeWhiteboardTokens.pencilGrainWidthScale)} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.pencilGrainSecondaryOpacityScale} stroke={color} strokeDasharray={secondaryTexture.dashArray} strokeDashoffset={secondaryTexture.dashOffset} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={Math.max(themeWhiteboardTokens.strokeEdgeFeatherWidthPx, renderWidth * themeWhiteboardTokens.pencilGrainSecondaryWidthScale)} />
        <PressureDetailPaths color={color} heavyPath={heavyPressurePath} mediumPath={mediumPressurePath} opacity={brush.opacity * themeWhiteboardTokens.pencilPressureCoreOpacityScale} width={renderWidth * themeWhiteboardTokens.pencilPressureCoreWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'marker') {
    const { centerPath, heavyPressurePath, mediumPressurePath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g data-whiteboard-brush="marker" shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.markerCoreOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.markerLineCap} strokeLinejoin={themeWhiteboardTokens.strokeLineJoin} strokeWidth={renderWidth * themeWhiteboardTokens.markerCoreWidthScale} />
        <PressureDetailPaths color={color} heavyPath={heavyPressurePath} mediumPath={mediumPressurePath} opacity={brush.opacity * themeWhiteboardTokens.markerPressureCoreOpacityScale} width={renderWidth * themeWhiteboardTokens.markerPressureCoreWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'crayon') {
    const { centerPath, heavyPressurePath, mediumPressurePath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    const primaryTexture = getWhiteboardStrokeDashStyle(stroke, themeWhiteboardTokens.crayonTextureDashArray, 0, 20);
    const secondaryTexture = getWhiteboardStrokeDashStyle(stroke, themeWhiteboardTokens.crayonTextureSecondaryDashArray, themeWhiteboardTokens.crayonTextureDashOffsetPx, 21);
    const waxTexture = getWhiteboardStrokeDashStyle(stroke, themeWhiteboardTokens.crayonWaxDashArray, 0, 22);
    return (
      <g data-whiteboard-brush="crayon" shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.crayonTextureOpacityScale} stroke={color} strokeDasharray={primaryTexture.dashArray} strokeDashoffset={primaryTexture.dashOffset} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.crayonTextureWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.crayonTextureSecondaryOpacityScale} stroke={color} strokeDasharray={secondaryTexture.dashArray} strokeDashoffset={secondaryTexture.dashOffset} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.crayonTextureSecondaryWidthScale} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={brush.opacity * themeWhiteboardTokens.crayonWaxOpacityScale} stroke={color} strokeDasharray={waxTexture.dashArray} strokeDashoffset={waxTexture.dashOffset} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={Math.max(themeWhiteboardTokens.strokeEdgeFeatherWidthPx, renderWidth * themeWhiteboardTokens.crayonWaxWidthScale)} />
        <PressureDetailPaths color={color} heavyPath={heavyPressurePath} mediumPath={mediumPressurePath} opacity={brush.opacity * themeWhiteboardTokens.crayonPressureCoreOpacityScale} width={renderWidth * themeWhiteboardTokens.crayonPressureCoreWidthScale} />
      </g>
    );
  }
  if (stroke.tool === 'fountain') {
    const { centerPath, pressurePath, renderWidth } = getStrokeRenderGeometry(stroke);
    return (
      <g data-whiteboard-brush="fountain" shapeRendering="geometricPrecision">
        <PressureStrokePath color={color} d={pressurePath} opacity={brush.opacity} />
        <path d={centerPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={themeWhiteboardTokens.fountainCoreOpacityScale} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={renderWidth * themeWhiteboardTokens.fountainCoreWidthScale} />
      </g>
    );
  }
  return (
    <g data-whiteboard-brush="pen" opacity={brush.opacity} shapeRendering="geometricPrecision">
      <PressureStrokePath color={color} d={getPressureStrokePath(stroke)} />
    </g>
  );
});

function WhiteboardStrokeDab({
  color,
  opacity,
  point,
  stroke,
  width,
}: {
  color: string;
  opacity: number;
  point: WhiteboardStroke['points'][number];
  stroke: WhiteboardStroke;
  width: number;
}) {
  const geometry = getStrokeDabGeometry(stroke.tool, width);
  const transform = geometry.angle ? `rotate(${geometry.angle} ${point.x} ${point.y})` : undefined;
  if (geometry.shape === 'rect') {
    return <rect data-whiteboard-brush-dab="marker" x={point.x - geometry.width / 2} y={point.y - geometry.height / 2} width={geometry.width} height={geometry.height} rx={themeWhiteboardTokens.strokeEdgeFeatherWidthPx} fill={color} opacity={opacity} transform={transform} />;
  }
  if (geometry.shape === 'ellipse') {
    return <ellipse data-whiteboard-brush-dab="fountain" cx={point.x} cy={point.y} rx={geometry.width / 2} ry={geometry.height / 2} fill={color} opacity={opacity} transform={transform} />;
  }
  if (stroke.tool === 'watercolor') {
    return (
      <g data-whiteboard-brush-dab="watercolor">
        <circle cx={point.x} cy={point.y} r={width * themeWhiteboardTokens.watercolorWashWidthScale / 2} fill={color} opacity={opacity * themeWhiteboardTokens.watercolorWashOpacityScale} />
        <circle cx={point.x} cy={point.y} r={width * themeWhiteboardTokens.watercolorOuterWidthScale / 2} fill={color} opacity={opacity} />
        <circle cx={point.x} cy={point.y} r={width / 2} fill={color} opacity={opacity * themeWhiteboardTokens.watercolorInnerOpacityScale} />
      </g>
    );
  }
  if (stroke.tool === 'pencil' || stroke.tool === 'crayon') {
    const dashArray = stroke.tool === 'pencil' ? themeWhiteboardTokens.pencilGrainDashArray : themeWhiteboardTokens.crayonTextureDashArray;
    const textureOpacity = stroke.tool === 'pencil' ? themeWhiteboardTokens.pencilGrainOpacityScale : themeWhiteboardTokens.crayonTextureOpacityScale;
    const texture = getWhiteboardStrokeDashStyle(stroke, dashArray, 0, 30);
    return (
      <g data-whiteboard-brush-dab={stroke.tool}>
        <circle cx={point.x} cy={point.y} r={width / 2} fill={color} opacity={opacity} />
        <circle cx={point.x} cy={point.y} r={Math.max(0, width / 2 - themeWhiteboardTokens.strokeEdgeFeatherWidthPx)} fill={themeWhiteboardTokens.strokeNoFill} opacity={opacity * textureOpacity} stroke={color} strokeDasharray={texture.dashArray} strokeDashoffset={texture.dashOffset} strokeWidth={themeWhiteboardTokens.strokeEdgeFeatherWidthPx} />
      </g>
    );
  }
  return <circle data-whiteboard-brush-dab="pen" cx={point.x} cy={point.y} fill={color} opacity={opacity} r={width / 2} />;
}

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

function PressureDetailPaths({ color, heavyPath, mediumPath, opacity, width }: {
  color: string;
  heavyPath: string;
  mediumPath: string;
  opacity: number;
  width: number;
}) {
  return (
    <>
      {mediumPath ? <path d={mediumPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={opacity} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={width} /> : null}
      {heavyPath ? <path d={heavyPath} fill={themeWhiteboardTokens.strokeNoFill} opacity={opacity} stroke={color} strokeLinecap={themeWhiteboardTokens.strokeLineCap} strokeWidth={width} /> : null}
    </>
  );
}
