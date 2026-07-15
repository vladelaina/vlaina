import { distanceToSegment } from './whiteboardSegmentGeometry';
import { getEraserSampledStrokePoints } from './whiteboardStrokeGeometry';
import {
  getStrokeEraserRadius,
  getStrokeWidth,
  type WhiteboardStroke,
} from './whiteboardModel';
import type { WhiteboardEraserSample } from './whiteboardEraser';

interface StrokeEraserSweep {
  end: WhiteboardEraserSample;
  radius: number;
  start: WhiteboardEraserSample;
}

export function eraseWhiteboardStrokes(
  strokes: WhiteboardStroke[],
  samples: WhiteboardEraserSample[],
): WhiteboardStroke[] {
  const sweeps = getSweeps(samples);
  if (sweeps.length === 0) return strokes;
  let changed = false;
  const next = strokes.flatMap((stroke) => {
    const erased = eraseStroke(stroke, sweeps);
    if (erased === stroke) return [stroke];
    changed = true;
    return erased.points.length > 0 ? [erased] : [];
  });
  return changed ? next : strokes;
}

function eraseStroke(stroke: WhiteboardStroke, sweeps: StrokeEraserSweep[]): WhiteboardStroke {
  const sampled = getEraserSampledStrokePoints(stroke);
  const points: WhiteboardStroke['points'] = [];
  let changed = false;
  let breakBefore = false;

  for (const point of sampled) {
    if (point.breakBefore) breakBefore = true;
    const width = getStrokeWidth(stroke.tool, point.pressure, stroke.size);
    const erased = sweeps.some((sweep) => (
      distanceToSegment(point, sweep.start.point, sweep.end.point) <= sweep.radius + width / 2
    ));
    if (erased) {
      changed = true;
      breakBefore = true;
      continue;
    }
    points.push({
      ...point,
      ...(breakBefore && points.length > 0 ? { breakBefore: true } : { breakBefore: undefined }),
    });
    breakBefore = false;
  }
  return changed ? { ...stroke, points } : stroke;
}

function getSweeps(samples: WhiteboardEraserSample[]): StrokeEraserSweep[] {
  if (samples.length === 0) return [];
  if (samples.length === 1) {
    const sample = samples[0];
    return [{ end: sample, radius: getStrokeEraserRadius(sample.size), start: sample }];
  }
  return samples.slice(1).map((end, index) => {
    const start = samples[index];
    return { end, radius: getStrokeEraserRadius(Math.max(start.size, end.size)), start };
  });
}
