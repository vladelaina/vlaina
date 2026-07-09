import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  getEraserRadius,
  getStrokeWidth,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardStrokePoint,
} from './whiteboardModel';

interface EraserBounds {
  maxWidth: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface WhiteboardEraserPoint {
  point: WhiteboardPoint;
  size: number;
}

const eraserBoundsCache = new WeakMap<WhiteboardStroke, EraserBounds | null>();

export function appendStrokePoints(
  currentPoints: WhiteboardStrokePoint[],
  nextPoints: WhiteboardStrokePoint[],
): WhiteboardStrokePoint[] {
  const points = [...currentPoints];
  appendStrokePointsInPlace(points, nextPoints);
  return points;
}

export function appendStrokePointsInPlace(
  points: WhiteboardStrokePoint[],
  nextPoints: WhiteboardStrokePoint[],
): void {
  for (const point of nextPoints) {
    const previous = points.at(-1);
    if (point.breakBefore || !previous || distance(previous, point) >= themeWhiteboardTokens.strokePointMinDistancePx) {
      points.push(point);
    }
  }
}

export function getStrokeRenderWidth(stroke: WhiteboardStroke): number {
  if (stroke.points.length === 0) return getStrokeWidth(stroke.tool, 1, stroke.size);
  const pressure = stroke.points.reduce((total, point) => total + point.pressure, 0) / stroke.points.length;
  return getStrokeWidth(stroke.tool, pressure, stroke.size);
}

export function getPressureStrokePath(stroke: WhiteboardStroke): string {
  return getStrokePointSegments(stroke.points).map((segment) => getPressureSegmentPath(stroke, segment)).join(' ');
}

export function getCenterStrokePath(stroke: WhiteboardStroke): string {
  return getStrokePointSegments(stroke.points).map(getOpenEdgePath).join(' ');
}

export function getStrokePointSegments(points: WhiteboardStrokePoint[]): WhiteboardStrokePoint[][] {
  const segments: WhiteboardStrokePoint[][] = [];
  let current: WhiteboardStrokePoint[] = [];
  for (const point of points) {
    if (point.breakBefore && current.length > 0) {
      segments.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

function getPressureSegmentPath(stroke: WhiteboardStroke, segment: WhiteboardStrokePoint[]): string {
  const points = getSmoothedStrokePoints(segment);
  if (points.length < 2) return '';
  const left: WhiteboardStrokePoint[] = [];
  const right: WhiteboardStrokePoint[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const point = points[index];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy) || 1;
    const radius = getStrokeWidth(stroke.tool, point.pressure, stroke.size) / 2;
    const normalX = -dy / length;
    const normalY = dx / length;

    left.push({ ...point, x: point.x + normalX * radius, y: point.y + normalY * radius });
    right.push({ ...point, x: point.x - normalX * radius, y: point.y - normalY * radius });
  }

  return `${getOpenEdgePath(left)} ${getOpenEdgePath([...right].reverse()).replace(/^M /, 'L ')} Z`;
}

export function eraseStrokeAtPoint(
  stroke: WhiteboardStroke,
  point: WhiteboardPoint,
  eraserSize: number,
): WhiteboardStroke[] {
  const radius = getEraserRadius(eraserSize);
  if (!canEraserTouchStroke(stroke, point, radius)) return [stroke];
  const chunks: WhiteboardStrokePoint[][] = [];
  let currentChunk: WhiteboardStrokePoint[] = [];
  let didErase = false;
  const sampledPoints = getEraseSampledPoints(stroke);

  for (let index = 0; index < sampledPoints.length; index += 1) {
    const current = sampledPoints[index];
    if (current.breakBefore && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
    }
    const width = getStrokeWidth(stroke.tool, current.pressure, stroke.size);
    const hitPoint = distance(point, current) <= radius + width / 2;

    if (hitPoint) {
      didErase = true;
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
      continue;
    }
    currentChunk.push(current);
  }

  if (!didErase) return [stroke];
  if (currentChunk.length > 0) chunks.push(currentChunk);
  return chunks.map((points, index) => ({
    ...stroke,
    id: `${stroke.id}-cut-${index}`,
    points,
  }));
}

export function eraseStrokesAtPoints(
  strokes: WhiteboardStroke[],
  points: WhiteboardEraserPoint[],
): WhiteboardStroke[] {
  return points.reduce(
    (current, eraserPoint) => current.flatMap((stroke) => eraseStrokeAtPoint(stroke, eraserPoint.point, eraserPoint.size)),
    strokes,
  );
}

function canEraserTouchStroke(stroke: WhiteboardStroke, point: WhiteboardPoint, radius: number): boolean {
  const bounds = getEraserBounds(stroke);
  if (!bounds) return false;
  const padding = radius + bounds.maxWidth / 2;
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding && point.y >= bounds.minY - padding && point.y <= bounds.maxY + padding;
}

function getEraserBounds(stroke: WhiteboardStroke): EraserBounds | null {
  const cached = eraserBoundsCache.get(stroke);
  if (cached !== undefined) return cached;
  if (stroke.points.length === 0) {
    eraserBoundsCache.set(stroke, null);
    return null;
  }
  const bounds = stroke.points.reduce<EraserBounds>((current, point) => ({
    maxWidth: Math.max(current.maxWidth, getStrokeWidth(stroke.tool, point.pressure, stroke.size)),
    maxX: Math.max(current.maxX, point.x),
    maxY: Math.max(current.maxY, point.y),
    minX: Math.min(current.minX, point.x),
    minY: Math.min(current.minY, point.y),
  }), { maxWidth: 0, maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity });
  eraserBoundsCache.set(stroke, bounds);
  return bounds;
}

function getSmoothedStrokePoints(points: WhiteboardStrokePoint[]): WhiteboardStrokePoint[] {
  if (points.length < 4) return points;
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return point;
    const previous = points[index - 1];
    const next = points[index + 1];
    return {
      pressure: (previous.pressure + point.pressure * 2 + next.pressure) / 4,
      x: (previous.x + point.x * 2 + next.x) / 4,
      y: (previous.y + point.y * 2 + next.y) / 4,
    };
  });
}

function getEraseSampledPoints(stroke: WhiteboardStroke): WhiteboardStrokePoint[] {
  const sampled: WhiteboardStrokePoint[] = [];

  for (const points of getStrokePointSegments(stroke.points)) {
    if (points.length === 0) continue;
    sampled.push({ ...points[0], breakBefore: sampled.length > 0 || points[0].breakBefore });
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      const segmentLength = distance(previous, current);
      const steps = Math.max(1, Math.ceil(segmentLength / themeWhiteboardTokens.eraserSampleStepPx));
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        sampled.push({
          pressure: previous.pressure + (current.pressure - previous.pressure) * progress,
          x: previous.x + (current.x - previous.x) * progress,
          y: previous.y + (current.y - previous.y) * progress,
        });
      }
    }
  }

  return sampled;
}

function getOpenEdgePath(points: WhiteboardStrokePoint[]): string {
  if (points.length === 0) return '';
  const [first] = points;
  if (points.length === 1) return `M ${first.x} ${first.y}`;
  if (points.length === 2) return `M ${first.x} ${first.y} L ${points[1].x} ${points[1].y}`;

  const commands = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const nextPoint = points[index + 1];
    const midpoint = {
      x: (point.x + nextPoint.x) / 2,
      y: (point.y + nextPoint.y) / 2,
    };
    commands.push(`Q ${point.x} ${point.y} ${midpoint.x} ${midpoint.y}`);
  }
  const last = points[points.length - 1];
  commands.push(`L ${last.x} ${last.y}`);
  return commands.join(' ');
}

function distance(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
