import {
  getWhiteboardElementCenter,
  type WhiteboardElement,
  type WhiteboardPoint,
} from './whiteboardModel';

export interface WhiteboardConnectorEndpoints {
  from: WhiteboardPoint;
  to: WhiteboardPoint;
}

export function getWhiteboardConnectorEndpoints(
  fromElement: WhiteboardElement,
  toElement: WhiteboardElement,
): WhiteboardConnectorEndpoints {
  const fromCenter = getWhiteboardElementCenter(fromElement);
  const toCenter = getWhiteboardElementCenter(toElement);
  return {
    from: getWhiteboardElementBoundaryPoint(fromElement, toCenter),
    to: getWhiteboardElementBoundaryPoint(toElement, fromCenter),
  };
}

export function getWhiteboardElementBoundaryPoint(element: WhiteboardElement, toward: WhiteboardPoint): WhiteboardPoint {
  const center = getWhiteboardElementCenter(element);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const radiusX = element.width / 2;
  const radiusY = element.height / 2;
  const scale = element.type === 'ellipse'
    ? 1 / Math.sqrt((dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY))
    : Math.min(
      dx === 0 ? Number.POSITIVE_INFINITY : radiusX / Math.abs(dx),
      dy === 0 ? Number.POSITIVE_INFINITY : radiusY / Math.abs(dy),
    );
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}
