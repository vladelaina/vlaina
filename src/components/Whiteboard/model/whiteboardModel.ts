import type { MessageKey } from '@/lib/i18n';
import { themeWhiteboardTokens } from '@/styles/themeTokens';

export type WhiteboardTool = 'select' | 'note' | 'rect' | 'ellipse' | 'connector';
export type WhiteboardElementType = 'note' | 'rect' | 'ellipse';

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface WhiteboardElement {
  id: string;
  type: WhiteboardElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface WhiteboardConnector {
  id: string;
  fromId: string;
  toId: string;
}

export const WHITEBOARD_INITIAL_VIEWPORT: WhiteboardViewport = {
  x: themeWhiteboardTokens.initialPanX,
  y: themeWhiteboardTokens.initialPanY,
  zoom: themeWhiteboardTokens.defaultZoom,
};

export const WHITEBOARD_TOOLS: Array<{
  id: WhiteboardTool;
  labelKey: MessageKey;
  icon: 'whiteboard.select' | 'whiteboard.note' | 'whiteboard.rect' | 'whiteboard.ellipse' | 'whiteboard.connector';
}> = [
  { id: 'select', labelKey: 'whiteboard.tool.select', icon: 'whiteboard.select' },
  { id: 'note', labelKey: 'whiteboard.tool.note', icon: 'whiteboard.note' },
  { id: 'rect', labelKey: 'whiteboard.tool.rect', icon: 'whiteboard.rect' },
  { id: 'ellipse', labelKey: 'whiteboard.tool.ellipse', icon: 'whiteboard.ellipse' },
  { id: 'connector', labelKey: 'whiteboard.tool.connector', icon: 'whiteboard.connector' },
];

export const WHITEBOARD_SEED_ELEMENTS: WhiteboardElement[] = [
  {
    id: 'wb-note-1',
    type: 'note',
    x: 180,
    y: 150,
    width: themeWhiteboardTokens.noteWidthPx,
    height: themeWhiteboardTokens.noteHeightPx,
    text: 'Idea',
  },
  {
    id: 'wb-rect-1',
    type: 'rect',
    x: 520,
    y: 170,
    width: themeWhiteboardTokens.shapeWidthPx,
    height: themeWhiteboardTokens.shapeHeightPx,
    text: 'Evidence',
  },
  {
    id: 'wb-ellipse-1',
    type: 'ellipse',
    x: 850,
    y: 170,
    width: themeWhiteboardTokens.shapeWidthPx,
    height: themeWhiteboardTokens.shapeHeightPx,
    text: 'Decision',
  },
];

export const WHITEBOARD_SEED_CONNECTORS: WhiteboardConnector[] = [
  { id: 'wb-connector-1', fromId: 'wb-note-1', toId: 'wb-rect-1' },
  { id: 'wb-connector-2', fromId: 'wb-rect-1', toId: 'wb-ellipse-1' },
];

export function clampWhiteboardZoom(zoom: number): number {
  return Math.min(
    themeWhiteboardTokens.maxZoom,
    Math.max(themeWhiteboardTokens.minZoom, Math.round(zoom * 100) / 100),
  );
}

export function createWhiteboardElement(
  type: Exclude<WhiteboardTool, 'select' | 'connector'>,
  point: WhiteboardPoint,
  index: number,
): WhiteboardElement {
  const isNote = type === 'note';
  const width = isNote ? themeWhiteboardTokens.noteWidthPx : themeWhiteboardTokens.shapeWidthPx;
  const height = isNote ? themeWhiteboardTokens.noteHeightPx : themeWhiteboardTokens.shapeHeightPx;

  return {
    id: `wb-${type}-${index}`,
    type,
    x: Math.round(point.x - width / 2),
    y: Math.round(point.y - height / 2),
    width,
    height,
    text: isNote ? 'Note' : 'Shape',
  };
}

export function getWhiteboardElementCenter(element: WhiteboardElement): WhiteboardPoint {
  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
}

export function resizeWhiteboardElement(
  element: WhiteboardElement,
  width: number,
  height: number,
): WhiteboardElement {
  return {
    ...element,
    width: Math.max(themeWhiteboardTokens.minElementWidthPx, Math.round(width)),
    height: Math.max(themeWhiteboardTokens.minElementHeightPx, Math.round(height)),
  };
}
