import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  getEraserRadius,
  getStrokeWidth,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardStrokePoint,
} from './whiteboardModel';
import { getStrokePointSegments } from './whiteboardStrokeRenderGeometry';
import { distanceBetweenSegments, distanceToSegment } from './whiteboardSegmentGeometry';

export {
  getCenterStrokePath,
  getPressureStrokePath,
  getStrokeDabGeometry,
  getStrokePointSegments,
  getStrokeRenderGeometry,
  getStrokeRenderWidth,
  type StrokeRenderGeometry,
  type StrokeDabGeometry,
} from './whiteboardStrokeRenderGeometry';

interface EraserBounds {
  maxWidth: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

const eraserBoundsCache = new WeakMap<WhiteboardStroke, EraserBounds | null>();
const eraserSampleCache = new WeakMap<WhiteboardStroke, WhiteboardStrokePoint[]>();

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
  minDistance: number = themeWhiteboardTokens.strokePointMinDistancePx,
): void {
  for (const point of nextPoints) {
    const previous = points.at(-1);
    if (point.breakBefore || !previous || distance(previous, point) >= minDistance) {
      points.push(point);
    }
  }
}

export function getStrokePointMinDistance(zoom: number): number {
  return themeWhiteboardTokens.strokePointMinDistancePx / Math.max(zoom, 0.1);
}

export function doesEraserSweepTouchStroke(
  stroke: WhiteboardStroke,
  start: WhiteboardPoint,
  end: WhiteboardPoint,
  eraserSize: number,
): boolean {
  const radius = getEraserRadius(eraserSize);
  if (!canEraserSweepTouchStroke(stroke, start, end, radius)) return false;
  const points = getEraserSampledStrokePoints(stroke);
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const width = getStrokeWidth(stroke.tool, current.pressure, stroke.size);
    const previous = points[index - 1];
    if (!previous || current.breakBefore) {
      if (distanceToSegment(current, start, end) <= radius + width / 2) return true;
      continue;
    }
    const previousWidth = getStrokeWidth(stroke.tool, previous.pressure, stroke.size);
    if (distanceBetweenSegments(start, end, previous, current) <= radius + Math.max(width, previousWidth) / 2) return true;
  }
  return false;
}

function canEraserSweepTouchStroke(
  stroke: WhiteboardStroke,
  start: WhiteboardPoint,
  end: WhiteboardPoint,
  radius: number,
): boolean {
  const bounds = getEraserBounds(stroke);
  if (!bounds) return false;
  const padding = radius + bounds.maxWidth / 2;
  return Math.max(start.x, end.x) >= bounds.minX - padding &&
    Math.min(start.x, end.x) <= bounds.maxX + padding &&
    Math.max(start.y, end.y) >= bounds.minY - padding &&
    Math.min(start.y, end.y) <= bounds.maxY + padding;
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

export function getEraserSampledStrokePoints(stroke: WhiteboardStroke): WhiteboardStrokePoint[] {
  const cached = eraserSampleCache.get(stroke);
  if (cached) return cached;
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

  eraserSampleCache.set(stroke, sampled);
  return sampled;
}

function distance(a: WhiteboardPoint, b: WhiteboardPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
