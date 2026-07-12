import type { MessageKey } from '@/lib/i18n';
import type { IconName } from '@/components/ui/icons';
import { themeWhiteboardTokens } from '@/styles/themeTokens';

export type WhiteboardTool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'pencil'
  | 'marker'
  | 'fountain'
  | 'watercolor'
  | 'crayon'
  | 'eraser'
  | 'ruler'
  | 'note'
  | 'rect'
  | 'ellipse'
  | 'image'
  | 'connector';
export type WhiteboardElementType = 'note' | 'rect' | 'ellipse' | 'image';
export type WhiteboardNoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'gray';
export type WhiteboardPaperStyle = 'blank' | 'dots' | 'grid' | 'ruled';
export type WhiteboardDrawingTool = Extract<WhiteboardTool, 'pen' | 'pencil' | 'marker' | 'fountain' | 'watercolor' | 'crayon'>;
export type WhiteboardBrushTool = WhiteboardDrawingTool | 'eraser';
export type WhiteboardBrushColors = Record<WhiteboardDrawingTool, string>;
export type WhiteboardBrushSizes = Record<WhiteboardBrushTool, number>;

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStrokePoint extends WhiteboardPoint {
  breakBefore?: boolean;
  pressure: number;
}

export interface WhiteboardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WhiteboardElement {
  id: string;
  type: WhiteboardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  imageAssetPath?: string;
  imageSrc?: string;
  noteColor?: WhiteboardNoteColor;
  text: string;
}

export interface WhiteboardConnector {
  id: string;
  fromId: string;
  toId: string;
}

export interface WhiteboardStroke {
  color: string;
  id: string;
  tool: WhiteboardDrawingTool;
  size: number;
  points: WhiteboardStrokePoint[];
}

interface WhiteboardToolConfig {
  id: WhiteboardTool;
  labelKey: MessageKey;
  icon: IconName;
}

export interface WhiteboardBrush {
  color: string;
  baseWidth: number;
  opacity: number;
  pressureWidth: number;
}

export const WHITEBOARD_INITIAL_VIEWPORT: WhiteboardViewport = {
  x: themeWhiteboardTokens.initialPanX,
  y: themeWhiteboardTokens.initialPanY,
  zoom: themeWhiteboardTokens.defaultZoom,
};

export const WHITEBOARD_TOOL_GROUPS: WhiteboardToolConfig[][] = [
  [
    { id: 'select', labelKey: 'whiteboard.tool.select', icon: 'whiteboard.select' },
    { id: 'hand', labelKey: 'whiteboard.tool.hand', icon: 'whiteboard.hand' },
  ],
  [
    { id: 'pen', labelKey: 'whiteboard.tool.pen', icon: 'whiteboard.pen' },
    { id: 'pencil', labelKey: 'whiteboard.tool.pencil', icon: 'whiteboard.pencil' },
    { id: 'marker', labelKey: 'whiteboard.tool.marker', icon: 'whiteboard.marker' },
    { id: 'fountain', labelKey: 'whiteboard.tool.fountain', icon: 'whiteboard.fountain' },
    { id: 'watercolor', labelKey: 'whiteboard.tool.watercolor', icon: 'whiteboard.watercolor' },
    { id: 'crayon', labelKey: 'whiteboard.tool.crayon', icon: 'whiteboard.crayon' },
    { id: 'eraser', labelKey: 'whiteboard.tool.eraser', icon: 'whiteboard.eraser' },
    { id: 'ruler', labelKey: 'whiteboard.tool.ruler', icon: 'whiteboard.ruler' },
  ],
  [
    { id: 'note', labelKey: 'whiteboard.tool.note', icon: 'whiteboard.note' },
    { id: 'rect', labelKey: 'whiteboard.tool.rect', icon: 'whiteboard.rect' },
    { id: 'ellipse', labelKey: 'whiteboard.tool.ellipse', icon: 'whiteboard.ellipse' },
    { id: 'connector', labelKey: 'whiteboard.tool.connector', icon: 'whiteboard.connector' },
  ],
];

export const WHITEBOARD_BRUSHES: Record<WhiteboardDrawingTool, WhiteboardBrush> = {
  pen: {
    color: 'var(--vlaina-color-whiteboard-pen)',
    baseWidth: themeWhiteboardTokens.penBaseWidthPx,
    opacity: 1,
    pressureWidth: themeWhiteboardTokens.penPressureWidthPx,
  },
  pencil: {
    color: 'var(--vlaina-color-whiteboard-pencil)',
    baseWidth: themeWhiteboardTokens.pencilBaseWidthPx,
    opacity: themeWhiteboardTokens.pencilOpacity,
    pressureWidth: themeWhiteboardTokens.pencilPressureWidthPx,
  },
  marker: {
    color: 'var(--vlaina-color-whiteboard-marker)',
    baseWidth: themeWhiteboardTokens.markerBaseWidthPx,
    opacity: themeWhiteboardTokens.markerOpacity,
    pressureWidth: themeWhiteboardTokens.markerPressureWidthPx,
  },
  fountain: {
    color: 'var(--vlaina-color-whiteboard-pen)',
    baseWidth: themeWhiteboardTokens.fountainBaseWidthPx,
    opacity: 1,
    pressureWidth: themeWhiteboardTokens.fountainPressureWidthPx,
  },
  watercolor: {
    color: 'var(--vlaina-color-whiteboard-watercolor)',
    baseWidth: themeWhiteboardTokens.watercolorBaseWidthPx,
    opacity: themeWhiteboardTokens.watercolorOpacity,
    pressureWidth: themeWhiteboardTokens.watercolorPressureWidthPx,
  },
  crayon: {
    color: 'var(--vlaina-color-whiteboard-crayon)',
    baseWidth: themeWhiteboardTokens.crayonBaseWidthPx,
    opacity: themeWhiteboardTokens.crayonOpacity,
    pressureWidth: themeWhiteboardTokens.crayonPressureWidthPx,
  },
};

export const WHITEBOARD_SEED_ELEMENTS: WhiteboardElement[] = [];
export const WHITEBOARD_SEED_CONNECTORS: WhiteboardConnector[] = [];
export const WHITEBOARD_SEED_STROKES: WhiteboardStroke[] = [];
export const WHITEBOARD_DEFAULT_BRUSH_SIZES: WhiteboardBrushSizes = {
  pen: 1,
  pencil: 1,
  marker: 1,
  fountain: 1,
  watercolor: 1,
  crayon: 1,
  eraser: 1,
};
export const WHITEBOARD_DEFAULT_BRUSH_COLORS: WhiteboardBrushColors = {
  pen: themeWhiteboardTokens.brushColorSwatches[0],
  pencil: themeWhiteboardTokens.brushColorSwatches[1],
  marker: themeWhiteboardTokens.brushColorSwatches[4],
  fountain: themeWhiteboardTokens.brushColorSwatches[0],
  watercolor: themeWhiteboardTokens.brushColorSwatches[3],
  crayon: themeWhiteboardTokens.brushColorSwatches[2],
};

export const WHITEBOARD_DEFAULT_NOTE_COLOR: WhiteboardNoteColor = 'yellow';
export const WHITEBOARD_DEFAULT_PAPER_STYLE: WhiteboardPaperStyle = 'dots';

export function clampWhiteboardZoom(zoom: number): number {
  return Math.min(
    themeWhiteboardTokens.maxZoom,
    Math.max(themeWhiteboardTokens.minZoom, Math.round(zoom * 100) / 100),
  );
}

export function screenPointToBoardPoint(
  point: WhiteboardPoint,
  viewport: WhiteboardViewport,
): WhiteboardPoint {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

export function zoomViewportAtPoint(
  viewport: WhiteboardViewport,
  screenPoint: WhiteboardPoint,
  nextZoom: number,
): WhiteboardViewport {
  const zoom = clampWhiteboardZoom(nextZoom);
  const boardPoint = screenPointToBoardPoint(screenPoint, viewport);
  return {
    x: Math.round((screenPoint.x - boardPoint.x * zoom) * 100) / 100,
    y: Math.round((screenPoint.y - boardPoint.y * zoom) * 100) / 100,
    zoom,
  };
}

export function getWhiteboardElementCenter(element: WhiteboardElement): WhiteboardPoint {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
}

export function resizeWhiteboardElement(
  element: WhiteboardElement,
  width: number,
  height: number,
): WhiteboardElement {
  return {
    ...element,
    width: Math.max(themeWhiteboardTokens.minElementWidthPx, Math.round(width)),
    height: Math.max(themeWhiteboardTokens.minElementHeightPx, Math.round(height)),
  };
}

export function createWhiteboardElement(
  id: string,
  type: Exclude<WhiteboardElementType, 'image'>,
  point: WhiteboardPoint,
): WhiteboardElement {
  const isNote = type === 'note';
  const width = isNote ? themeWhiteboardTokens.noteWidthPx : themeWhiteboardTokens.shapeWidthPx;
  const height = isNote ? themeWhiteboardTokens.noteHeightPx : themeWhiteboardTokens.shapeHeightPx;
  return {
    id,
    type,
    x: Math.round(point.x - width / 2),
    y: Math.round(point.y - height / 2),
    width,
    height,
    text: '',
  };
}

export function isDrawingTool(tool: WhiteboardTool): tool is WhiteboardDrawingTool {
  return tool === 'pen' || tool === 'pencil' || tool === 'marker' || tool === 'fountain' || tool === 'watercolor' || tool === 'crayon';
}

export function isBrushTool(tool: WhiteboardTool): tool is WhiteboardBrushTool {
  return isDrawingTool(tool) || tool === 'eraser';
}

export function getStrokeWidth(tool: WhiteboardDrawingTool, pressure: number, size = 1): number {
  const brush = WHITEBOARD_BRUSHES[tool];
  return (brush.baseWidth + brush.pressureWidth * normalizePressure(pressure)) * size;
}

export function getBrushPreviewRadius(tool: WhiteboardBrushTool, size: number): number {
  if (tool === 'eraser') return getEraserRadius(size);
  return getStrokeWidth(tool, 1, size) / 2;
}

export function getEraserRadius(size: number): number {
  return themeWhiteboardTokens.eraserRadiusPx * size;
}

export function resizeBrushSize(size: number, deltaY: number): number {
  const direction = deltaY > 0 ? -1 : 1;
  const nextSize = size + direction * themeWhiteboardTokens.brushWheelStep;
  return Math.min(
    themeWhiteboardTokens.maxBrushSize,
    Math.max(themeWhiteboardTokens.minBrushSize, Math.round(nextSize * 100) / 100),
  );
}

export function createStrokePoint(point: WhiteboardPoint, pressure: number): WhiteboardStrokePoint {
  return {
    ...point,
    pressure: normalizePressure(pressure),
  };
}

function normalizePressure(pressure: number): number {
  if (!Number.isFinite(pressure) || pressure <= 0) return themeWhiteboardTokens.defaultPointerPressure;
  return Math.min(1, Math.max(themeWhiteboardTokens.minPointerPressure, pressure));
}
