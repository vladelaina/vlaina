import { DEFAULT_POSITION_PERCENT } from './coverConstants';

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

export function getBaseDimensions(mediaSize: Size, containerSize: Size): Size {
  const mediaRatio = mediaSize.width / mediaSize.height;
  const containerRatio = containerSize.width / containerSize.height;

  if (mediaRatio > containerRatio) {
    return {
      width: containerSize.height * mediaRatio,
      height: containerSize.height,
    };
  }

  return {
    width: containerSize.width,
    height: containerSize.width / mediaRatio,
  };
}

export function calculateCropPixels(
  positionPercent: Point,
  mediaSize: Size,
  containerSize: Size,
  zoom: number
): Point {
  const baseDims = getBaseDimensions(mediaSize, containerSize);
  const scaledW = baseDims.width * zoom;
  const scaledH = baseDims.height * zoom;
  const maxTranslateX = (scaledW - containerSize.width) / 2;
  const maxTranslateY = (scaledH - containerSize.height) / 2;

  return {
    x: normalizeZero(((DEFAULT_POSITION_PERCENT - positionPercent.x) / DEFAULT_POSITION_PERCENT) * maxTranslateX),
    y: normalizeZero(((DEFAULT_POSITION_PERCENT - positionPercent.y) / DEFAULT_POSITION_PERCENT) * maxTranslateY),
  };
}

export function calculateCropPercentage(
  cropPixels: Point,
  mediaSize: Size,
  containerSize: Size,
  zoom: number
): Point {
  const baseDims = getBaseDimensions(mediaSize, containerSize);
  const scaledW = baseDims.width * zoom;
  const scaledH = baseDims.height * zoom;
  const maxTranslateX = (scaledW - containerSize.width) / 2;
  const maxTranslateY = (scaledH - containerSize.height) / 2;

  const percentX = maxTranslateX > 0
    ? DEFAULT_POSITION_PERCENT - (cropPixels.x / maxTranslateX) * DEFAULT_POSITION_PERCENT
    : DEFAULT_POSITION_PERCENT;
  const percentY = maxTranslateY > 0
    ? DEFAULT_POSITION_PERCENT - (cropPixels.y / maxTranslateY) * DEFAULT_POSITION_PERCENT
    : DEFAULT_POSITION_PERCENT;

  return {
    x: clampPercent(percentX),
    y: clampPercent(percentY),
  };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizeZero(value: number) {
  return Math.abs(value) < 1e-6 ? 0 : value;
}
