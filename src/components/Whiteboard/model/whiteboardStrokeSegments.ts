import type { WhiteboardStroke, WhiteboardStrokePoint } from './whiteboardModel';

export function splitWhiteboardStrokeSegments(strokes: WhiteboardStroke[]): WhiteboardStroke[] {
  const usedIds = new Set(strokes.map((stroke) => stroke.id));
  let changed = false;
  const result = strokes.flatMap((stroke) => {
    const segments = splitStrokePoints(stroke.points);
    if (
      segments.length === 1 &&
      segments[0].length === stroke.points.length &&
      segments[0].every((point, index) => point === stroke.points[index])
    ) return [stroke];
    changed = true;
    return segments.map((points, index) => ({
      ...stroke,
      id: index === 0 ? stroke.id : createSegmentId(stroke.id, usedIds),
      points,
    }));
  });
  return changed ? result : strokes;
}

function splitStrokePoints(points: WhiteboardStrokePoint[]): WhiteboardStrokePoint[][] {
  const segments: WhiteboardStrokePoint[][] = [];
  let current: WhiteboardStrokePoint[] = [];
  points.forEach((point) => {
    if (point.breakBefore && current.length > 0) {
      segments.push(current);
      current = [];
    }
    current.push(removeBreakMarker(point));
  });
  if (current.length > 0) segments.push(current);
  return segments;
}

function removeBreakMarker(point: WhiteboardStrokePoint): WhiteboardStrokePoint {
  if (!point.breakBefore) return point;
  const { breakBefore: _breakBefore, ...cleanPoint } = point;
  return cleanPoint;
}

function createSegmentId(baseId: string, usedIds: Set<string>): string {
  let index = 2;
  let id = `${baseId}-part-${index}`;
  while (usedIds.has(id)) {
    index += 1;
    id = `${baseId}-part-${index}`;
  }
  usedIds.add(id);
  return id;
}
