import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { createStrokePoint, type WhiteboardDrawingTool, type WhiteboardPoint, type WhiteboardStrokePoint } from './whiteboardModel';

export interface WhiteboardStrokeInputSample {
  point: WhiteboardPoint;
  pointerType: string;
  pressure: number;
  screenPoint?: WhiteboardPoint;
  timeStamp: number;
}

export interface WhiteboardStrokeInputState {
  point: WhiteboardPoint;
  pressure: number;
  timeStamp: number;
}

export function createResponsiveStrokePoints(
  tool: WhiteboardDrawingTool,
  samples: WhiteboardStrokeInputSample[],
  initialState: WhiteboardStrokeInputState | null,
): { points: WhiteboardStrokePoint[]; state: WhiteboardStrokeInputState | null } {
  let state = initialState;
  const points = samples.map((sample) => {
    const targetPressure = sample.pointerType === 'pen'
      ? createStrokePoint(sample.point, sample.pressure).pressure
      : getMousePressure(tool, sample, state);
    const pressure = state
      ? state.pressure + (targetPressure - state.pressure) * themeWhiteboardTokens.pointerPressureSmoothing[tool]
      : targetPressure;
    const point = createStrokePoint(sample.point, pressure);
    state = { point: sample.screenPoint ?? sample.point, pressure: point.pressure, timeStamp: sample.timeStamp };
    return point;
  });
  return { points, state };
}

function getMousePressure(
  tool: WhiteboardDrawingTool,
  sample: WhiteboardStrokeInputSample,
  previous: WhiteboardStrokeInputState | null,
): number {
  if (!previous) return themeWhiteboardTokens.defaultPointerPressure;
  const elapsed = Math.max(1, sample.timeStamp - previous.timeStamp);
  const speedPoint = sample.screenPoint ?? sample.point;
  const speed = Math.hypot(speedPoint.x - previous.point.x, speedPoint.y - previous.point.y) / elapsed;
  const speedRatio = Math.min(1, speed / themeWhiteboardTokens.mousePressureSpeedPxPerMs);
  const range = themeWhiteboardTokens.mousePressureRange[tool];
  return range.max - (range.max - range.min) * speedRatio;
}
