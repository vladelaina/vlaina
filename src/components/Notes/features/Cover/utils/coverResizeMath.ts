import { DEFAULT_SCALE, MAX_HEIGHT, MAX_SCALE, MIN_HEIGHT } from './coverConstants';
import { getBaseDimensions } from './coverGeometry';

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export interface ResizeSnapshot {
  scaledWidth: number;
  scaledHeight: number;
  absoluteTop: number;
  absoluteLeft: number;
  containerWidth: number;
  maxVisualHeightNoShift: number;
  maxShiftDown: number;
  maxMechanicalHeight: number;
}

export function buildResizeSnapshot(
  mediaSize: Size,
  containerSize: Size,
  zoom: number,
  crop: Point
): ResizeSnapshot {
  const baseDims = getBaseDimensions(mediaSize, containerSize);
  const scaledWidth = baseDims.width * zoom;
  const scaledHeight = baseDims.height * zoom;

  const absoluteTop = containerSize.height / 2 + crop.y - scaledHeight / 2;
  const absoluteLeft = containerSize.width / 2 + crop.x - scaledWidth / 2;
  const maxVisualHeightNoShift = absoluteTop + scaledHeight;
  const maxShiftDown = Math.max(0, -absoluteTop);
  const maxMechanicalHeight = maxVisualHeightNoShift + maxShiftDown;

  return {
    scaledWidth,
    scaledHeight,
    absoluteTop,
    absoluteLeft,
    containerWidth: containerSize.width,
    maxVisualHeightNoShift,
    maxShiftDown,
    maxMechanicalHeight,
  };
}

export function calculateEffectiveResizeHeight(
  startHeight: number,
  deltaY: number,
  maxMechanicalHeight: number
): number {
  const rawHeight = startHeight + deltaY;
  const limitHeight = Math.min(MAX_HEIGHT, maxMechanicalHeight);
  return Math.max(MIN_HEIGHT, Math.min(limitHeight, rawHeight));
}

export function calculateVerticalShift(
  effectiveHeight: number,
  maxVisualHeightNoShift: number,
  maxShiftDown: number
): number {
  let shiftY = 0;
  if (effectiveHeight > maxVisualHeightNoShift) {
    shiftY = effectiveHeight - maxVisualHeightNoShift;
  }
  return Math.max(0, Math.min(shiftY, maxShiftDown));
}

export function calculateResizedScale(
  snapshot: ResizeSnapshot,
  mediaSize: Size,
  containerSize: Size
): number {
  const nextBaseDimensions = getBaseDimensions(mediaSize, containerSize);
  const nextScale = snapshot.scaledHeight / nextBaseDimensions.height;

  if (!Number.isFinite(nextScale) || nextScale <= 0) {
    return DEFAULT_SCALE;
  }

  return Math.max(DEFAULT_SCALE, Math.min(MAX_SCALE, nextScale));
}

export function calculateFinalCropFromResize(
  snapshot: ResizeSnapshot,
  effectiveHeight: number,
  shiftY: number
): Point {
  const finalImageTop = snapshot.absoluteTop + shiftY;
  const nextCropY = finalImageTop - effectiveHeight / 2 + snapshot.scaledHeight / 2;
  const nextCropX = snapshot.absoluteLeft - snapshot.containerWidth / 2 + snapshot.scaledWidth / 2;

  const maxAbsY = (snapshot.scaledHeight - effectiveHeight) / 2;
  const maxAbsX = (snapshot.scaledWidth - snapshot.containerWidth) / 2;

  const safeCropX = Number.isFinite(nextCropX)
    ? Math.max(-maxAbsX, Math.min(maxAbsX, nextCropX))
    : 0;
  const safeCropY = Number.isFinite(nextCropY)
    ? Math.max(-maxAbsY, Math.min(maxAbsY, nextCropY))
    : 0;

  return { x: safeCropX, y: safeCropY };
}
