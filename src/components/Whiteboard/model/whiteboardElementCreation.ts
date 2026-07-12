import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  createWhiteboardElement,
  type WhiteboardElement,
  type WhiteboardElementType,
  type WhiteboardPoint,
} from './whiteboardModel';

type PlaceableElementType = Exclude<WhiteboardElementType, 'image'>;

export function createWhiteboardElementFromDrag(
  id: string,
  type: PlaceableElementType,
  startPoint: WhiteboardPoint,
  currentPoint: WhiteboardPoint,
): WhiteboardElement {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  if (Math.hypot(dx, dy) < themeWhiteboardTokens.elementPlacementDragThresholdPx) {
    return createWhiteboardElement(id, type, startPoint);
  }

  const width = Math.max(themeWhiteboardTokens.minElementWidthPx, Math.abs(dx));
  const height = Math.max(themeWhiteboardTokens.minElementHeightPx, Math.abs(dy));
  return {
    ...createWhiteboardElement(id, type, startPoint),
    x: Math.round(dx < 0 ? startPoint.x - width : startPoint.x),
    y: Math.round(dy < 0 ? startPoint.y - height : startPoint.y),
    width: Math.round(width),
    height: Math.round(height),
  };
}
