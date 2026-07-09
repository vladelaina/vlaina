import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  getStrokeWidth,
  resizeWhiteboardElement,
  type WhiteboardElement,
  type WhiteboardPoint,
  type WhiteboardStroke,
} from './whiteboardModel';
import { getStrokePointSegments } from './whiteboardStrokeGeometry';

export type WhiteboardResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const strokeBoundsCache = new WeakMap<WhiteboardStroke, WhiteboardSelectionRect | null>();

export interface WhiteboardSelectionRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export type WhiteboardLassoPath = WhiteboardPoint[];

export function getRectFromPoints(start: WhiteboardPoint, end: WhiteboardPoint): WhiteboardSelectionRect {
  return {
    height: Math.abs(end.y - start.y),
    width: Math.abs(end.x - start.x),
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
  };
}

export function getStrokeBounds(stroke: WhiteboardStroke): WhiteboardSelectionRect | null {
  const cached = strokeBoundsCache.get(stroke);
  if (cached !== undefined) return cached;
  if (stroke.points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxWidth = 0;
  for (const point of stroke.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
    maxWidth = Math.max(maxWidth, getStrokeWidth(stroke.tool, point.pressure, stroke.size));
  }
  const padding = maxWidth / 2 + themeWhiteboardTokens.strokeSelectionPaddingPx;
  const bounds = {
    height: maxY - minY + padding * 2,
    width: maxX - minX + padding * 2,
    x: minX - padding,
    y: minY - padding,
  };
  strokeBoundsCache.set(stroke, bounds);
  return bounds;
}

export function getElementBounds(element: WhiteboardElement): WhiteboardSelectionRect {
  return { height: element.height, width: element.width, x: element.x, y: element.y };
}

export function getBoundsUnion(bounds: WhiteboardSelectionRect[]): WhiteboardSelectionRect | null {
  if (bounds.length === 0) return null;
  const padding = themeWhiteboardTokens.strokeSelectionPaddingPx;
  const minX = Math.min(...bounds.map((rect) => rect.x));
  const minY = Math.min(...bounds.map((rect) => rect.y));
  const maxX = Math.max(...bounds.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...bounds.map((rect) => rect.y + rect.height));
  return {
    height: maxY - minY + padding * 2,
    width: maxX - minX + padding * 2,
    x: minX - padding,
    y: minY - padding,
  };
}

export function getSelectionBounds(
  elements: WhiteboardElement[],
  strokes: WhiteboardStroke[],
  elementIds: string[],
  strokeIds: string[],
): WhiteboardSelectionRect | null {
  const selectedElementIds = new Set(elementIds);
  const selectedStrokeIds = new Set(strokeIds);
  return getBoundsUnion([
    ...elements.flatMap((element) => (selectedElementIds.has(element.id) ? [getElementBounds(element)] : [])),
    ...strokes.flatMap((stroke) => {
      if (!selectedStrokeIds.has(stroke.id)) return [];
      const bounds = getStrokeBounds(stroke);
      return bounds ? [bounds] : [];
    }),
  ]);
}

export function getResizedSelectionBounds(
  bounds: WhiteboardSelectionRect,
  startPoint: WhiteboardPoint,
  point: WhiteboardPoint,
  handle: WhiteboardResizeHandle,
  preserveAspectRatio: boolean,
): WhiteboardSelectionRect {
  const dx = point.x - startPoint.x;
  const dy = point.y - startPoint.y;
  const next = { ...bounds };
  if (handle.includes('e')) next.width = bounds.width + dx;
  if (handle.includes('s')) next.height = bounds.height + dy;
  if (handle.includes('w')) {
    next.x = bounds.x + dx;
    next.width = bounds.width - dx;
  }
  if (handle.includes('n')) {
    next.y = bounds.y + dy;
    next.height = bounds.height - dy;
  }
  const resized = preserveAspectRatio && handle.length === 2 ? preserveBoundsAspectRatio(bounds, next, handle) : next;
  return clampResizeBounds(bounds, resized, handle);
}

export function resizeSelectionElements(
  elements: WhiteboardElement[],
  originalElements: WhiteboardElement[] | Map<string, WhiteboardElement>,
  startBounds: WhiteboardSelectionRect,
  nextBounds: WhiteboardSelectionRect,
): WhiteboardElement[] {
  const originalById = toElementMap(originalElements);
  return elements.map((element) => {
    const original = originalById.get(element.id);
    if (!original) return element;
    const scaled = scaleRect(getElementBounds(original), startBounds, nextBounds);
    return resizeWhiteboardElement({ ...element, x: Math.round(scaled.x), y: Math.round(scaled.y) }, scaled.width, scaled.height);
  });
}

export function resizeSelectionStrokes(
  strokes: WhiteboardStroke[],
  originalStrokes: WhiteboardStroke[] | Map<string, WhiteboardStroke>,
  startBounds: WhiteboardSelectionRect,
  nextBounds: WhiteboardSelectionRect,
): WhiteboardStroke[] {
  const originalById = toStrokeMap(originalStrokes);
  return strokes.map((stroke) => {
    const original = originalById.get(stroke.id);
    if (!original) return stroke;
    return {
      ...stroke,
      points: original.points.map((point) => scalePoint(point, startBounds, nextBounds)),
    };
  });
}

export function findStrokeAtPoint(
  strokes: WhiteboardStroke[],
  point: WhiteboardPoint,
  zoom: number,
): WhiteboardStroke | null {
  const tolerance = themeWhiteboardTokens.strokeHitTolerancePx / zoom;
  for (let index = strokes.length - 1; index >= 0; index -= 1) {
    const stroke = strokes[index];
    if (isPointNearStroke(stroke, point, tolerance)) return stroke;
  }
  return null;
}

export function getStrokesInRect(strokes: WhiteboardStroke[], rect: WhiteboardSelectionRect): string[] {
  return strokes.flatMap((stroke) => (strokeIntersectsRect(stroke, rect) ? [stroke.id] : []));
}

export function getElementsInRect(elements: WhiteboardElement[], rect: WhiteboardSelectionRect): string[] {
  return elements.flatMap((element) => (rectsOverlap(getElementBounds(element), rect) ? [element.id] : []));
}

export function getLassoBounds(path: WhiteboardLassoPath): WhiteboardSelectionRect | null {
  if (path.length === 0) return null;
  const minX = Math.min(...path.map((point) => point.x));
  const minY = Math.min(...path.map((point) => point.y));
  const maxX = Math.max(...path.map((point) => point.x));
  const maxY = Math.max(...path.map((point) => point.y));
  return { height: maxY - minY, width: maxX - minX, x: minX, y: minY };
}

export function getElementsInLasso(elements: WhiteboardElement[], path: WhiteboardLassoPath): string[] {
  if (!isUsableLasso(path)) return [];
  const lassoBounds = getLassoBounds(path);
  if (!lassoBounds) return [];
  return elements.flatMap((element) => (
    elementIntersectsLasso(element, path, lassoBounds) ? [element.id] : []
  ));
}

export function getStrokesInLasso(strokes: WhiteboardStroke[], path: WhiteboardLassoPath): string[] {
  if (!isUsableLasso(path)) return [];
  const lassoBounds = getLassoBounds(path);
  if (!lassoBounds) return [];
  return strokes.flatMap((stroke) => (
    strokeIntersectsLasso(stroke, path, lassoBounds) ? [stroke.id] : []
  ));
}

export function translateStroke(stroke: WhiteboardStroke, dx: number, dy: number): WhiteboardStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point, x: point.x + dx, y: point.y + dy })),
  };
}

export function translateStrokesFromOriginals(
  strokes: WhiteboardStroke[],
  originalStrokes: WhiteboardStroke[] | Map<string, WhiteboardStroke>,
  dx: number,
  dy: number,
): WhiteboardStroke[] {
  const originalById = toStrokeMap(originalStrokes);
  return strokes.map((stroke) => {
    const original = originalById.get(stroke.id);
    return original ? translateStroke(original, dx, dy) : stroke;
  });
}

const toElementMap = (elements: WhiteboardElement[] | Map<string, WhiteboardElement>) => elements instanceof Map ? elements : new Map(elements.map((element) => [element.id, element]));

const toStrokeMap = (strokes: WhiteboardStroke[] | Map<string, WhiteboardStroke>) => strokes instanceof Map ? strokes : new Map(strokes.map((stroke) => [stroke.id, stroke]));

function isPointNearStroke(stroke: WhiteboardStroke, point: WhiteboardPoint, tolerance: number): boolean {
  if (stroke.points.length === 0) return false;
  if (stroke.points.length === 1) {
    return distance(stroke.points[0], point) <= getStrokeMaxWidth(stroke) / 2 + tolerance;
  }
  return getStrokePointSegments(stroke.points).some((segment) => segment.some((current, index) => {
    const previous = segment[index - 1];
    const width = getStrokeWidth(stroke.tool, current.pressure, stroke.size);
    return previous && distanceToSegment(point, previous, current) <= width / 2 + tolerance;
  }));
}

function strokeIntersectsRect(stroke: WhiteboardStroke, rect: WhiteboardSelectionRect): boolean {
  const bounds = getStrokeBounds(stroke);
  if (!bounds || !rectsOverlap(bounds, rect)) return false;
  return stroke.points.some((point) => pointInRect(point, rect));
}

function isUsableLasso(path: WhiteboardLassoPath): boolean {
  const bounds = getLassoBounds(path);
  return path.length >= 3 && Boolean(bounds && (bounds.width >= 3 || bounds.height >= 3));
}

function elementIntersectsLasso(
  element: WhiteboardElement,
  path: WhiteboardLassoPath,
  lassoBounds: WhiteboardSelectionRect,
): boolean {
  const bounds = getElementBounds(element);
  if (!rectsOverlap(bounds, lassoBounds)) return false;
  const points = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
  ];
  return points.some((point) => pointInPolygon(point, path)) || lassoSegments(path).some(([start, end]) => segmentIntersectsRect(start, end, bounds));
}

function strokeIntersectsLasso(
  stroke: WhiteboardStroke,
  path: WhiteboardLassoPath,
  lassoBounds: WhiteboardSelectionRect,
): boolean {
  const bounds = getStrokeBounds(stroke);
  if (!bounds || !rectsOverlap(bounds, lassoBounds)) return false;
  if (stroke.points.some((point) => pointInPolygon(point, path))) return true;
  const lasso = lassoSegments(path);
  return getStrokePointSegments(stroke.points).some((segment) => segment.some((current, index) => {
    const previous = segment[index - 1];
    return previous ? lasso.some(([start, end]) => segmentsIntersect(previous, current, start, end)) : false;
  }));
}

function getStrokeMaxWidth(stroke: WhiteboardStroke): number {
  return stroke.points.reduce(
    (maxWidth, point) => Math.max(maxWidth, getStrokeWidth(stroke.tool, point.pressure, stroke.size)),
    0,
  );
}

function pointInRect(point: WhiteboardPoint, rect: WhiteboardSelectionRect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function pointInPolygon(point: WhiteboardPoint, polygon: WhiteboardLassoPath): boolean {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const xAtY = ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crossesY && point.x < xAtY) inside = !inside;
  }
  return inside;
}

function lassoSegments(path: WhiteboardLassoPath): Array<[WhiteboardPoint, WhiteboardPoint]> {
  return path.map((point, index) => [point, path[(index + 1) % path.length]]);
}

function segmentIntersectsRect(start: WhiteboardPoint, end: WhiteboardPoint, rect: WhiteboardSelectionRect): boolean {
  if (pointInRect(start, rect) || pointInRect(end, rect)) return true;
  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };
  return [
    [topLeft, topRight],
    [topRight, bottomRight],
    [bottomRight, bottomLeft],
    [bottomLeft, topLeft],
  ].some(([edgeStart, edgeEnd]) => segmentsIntersect(start, end, edgeStart, edgeEnd));
}

function segmentsIntersect(a: WhiteboardPoint, b: WhiteboardPoint, c: WhiteboardPoint, d: WhiteboardPoint): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (abC === 0 && pointOnSegment(c, a, b)) return true;
  if (abD === 0 && pointOnSegment(d, a, b)) return true;
  if (cdA === 0 && pointOnSegment(a, c, d)) return true;
  if (cdB === 0 && pointOnSegment(b, c, d)) return true;
  return abC !== abD && cdA !== cdB;
}

function orientation(a: WhiteboardPoint, b: WhiteboardPoint, c: WhiteboardPoint): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 0.000001) return 0;
  return value > 0 ? 1 : 2;
}

function pointOnSegment(point: WhiteboardPoint, start: WhiteboardPoint, end: WhiteboardPoint): boolean {
  return point.x <= Math.max(start.x, end.x) && point.x >= Math.min(start.x, end.x)
    && point.y <= Math.max(start.y, end.y) && point.y >= Math.min(start.y, end.y);
}

function preserveBoundsAspectRatio(
  start: WhiteboardSelectionRect,
  next: WhiteboardSelectionRect,
  handle: WhiteboardResizeHandle,
): WhiteboardSelectionRect {
  const ratio = start.width / Math.max(1, start.height);
  const widthChangedMore = Math.abs(next.width - start.width) >= Math.abs(next.height - start.height);
  const width = widthChangedMore ? next.width : next.height * ratio;
  const height = widthChangedMore ? next.width / ratio : next.height;
  return {
    height,
    width,
    x: handle.includes('w') ? start.x + start.width - width : start.x,
    y: handle.includes('n') ? start.y + start.height - height : start.y,
  };
}

function clampResizeBounds(
  start: WhiteboardSelectionRect,
  next: WhiteboardSelectionRect,
  handle: WhiteboardResizeHandle,
): WhiteboardSelectionRect {
  const minSize = themeWhiteboardTokens.selectionResizeMinSizePx;
  const width = Math.max(minSize, next.width);
  const height = Math.max(minSize, next.height);
  return {
    height,
    width,
    x: handle.includes('w') ? start.x + start.width - width : next.x,
    y: handle.includes('n') ? start.y + start.height - height : next.y,
  };
}

function scaleRect(
  rect: WhiteboardSelectionRect,
  startBounds: WhiteboardSelectionRect,
  nextBounds: WhiteboardSelectionRect,
): WhiteboardSelectionRect {
  const scaleX = nextBounds.width / Math.max(1, startBounds.width);
  const scaleY = nextBounds.height / Math.max(1, startBounds.height);
  return {
    height: rect.height * scaleY,
    width: rect.width * scaleX,
    x: nextBounds.x + (rect.x - startBounds.x) * scaleX,
    y: nextBounds.y + (rect.y - startBounds.y) * scaleY,
  };
}

function scalePoint<T extends WhiteboardPoint>(
  point: T,
  startBounds: WhiteboardSelectionRect,
  nextBounds: WhiteboardSelectionRect,
): T {
  const scaleX = nextBounds.width / Math.max(1, startBounds.width);
  const scaleY = nextBounds.height / Math.max(1, startBounds.height);
  return {
    ...point,
    x: nextBounds.x + (point.x - startBounds.x) * scaleX,
    y: nextBounds.y + (point.y - startBounds.y) * scaleY,
  };
}

export function rectsOverlap(a: WhiteboardSelectionRect, b: WhiteboardSelectionRect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function distance(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: WhiteboardPoint, start: WhiteboardPoint, end: WhiteboardPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distance(point, start);
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + dx * progress), point.y - (start.y + dy * progress));
}
