import {
  WHITEBOARD_INITIAL_VIEWPORT,
  WHITEBOARD_SEED_CONNECTORS,
  WHITEBOARD_SEED_ELEMENTS,
  WHITEBOARD_SEED_STROKES,
  clampWhiteboardZoom,
  resizeWhiteboardElement,
  type WhiteboardConnector,
  type WhiteboardDrawingTool,
  type WhiteboardElement,
  type WhiteboardElementType,
  type WhiteboardStroke,
  type WhiteboardStrokePoint,
  type WhiteboardViewport,
} from './whiteboardModel';

export const WHITEBOARD_DOCUMENT_FORMAT = 'vlaina.whiteboard';
export const WHITEBOARD_DOCUMENT_MIME_TYPE = 'application/vnd.vlaina.whiteboard+json';
export const WHITEBOARD_DOCUMENT_VERSION = 1;

export interface WhiteboardRulerSnapshot {
  angle: number;
  visible: boolean;
  x: number;
  y: number;
}

export interface WhiteboardSnapshot {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
  viewport: WhiteboardViewport;
  ruler?: WhiteboardRulerSnapshot;
}

type WhiteboardDocumentStrokePoint = [number, number, number] | [number, number, number, true];

interface WhiteboardDocumentStroke extends Omit<WhiteboardStroke, 'points'> {
  points: WhiteboardDocumentStrokePoint[];
}

interface WhiteboardDocumentContent extends Omit<WhiteboardSnapshot, 'strokes'> {
  strokes: WhiteboardDocumentStroke[];
}

export interface WhiteboardDocumentV1 {
  format: typeof WHITEBOARD_DOCUMENT_FORMAT;
  version: typeof WHITEBOARD_DOCUMENT_VERSION;
  content: WhiteboardDocumentContent;
}

type JsonRecord = Record<string, unknown>;

const elementTypes = new Set<WhiteboardElementType>(['note', 'rect', 'ellipse', 'image']);
const drawingTools = new Set<WhiteboardDrawingTool>(['pen', 'pencil', 'marker', 'fountain', 'watercolor', 'crayon']);

export function createWhiteboardDocument(snapshot: WhiteboardSnapshot): WhiteboardDocumentV1 {
  const content = normalizeWhiteboardSnapshot(snapshot);
  return {
    content: {
      ...content,
      elements: content.elements.map(encodeElement),
      strokes: content.strokes.map(encodeStroke),
    },
    format: WHITEBOARD_DOCUMENT_FORMAT,
    version: WHITEBOARD_DOCUMENT_VERSION,
  };
}

export function serializeWhiteboardSnapshot(snapshot: WhiteboardSnapshot): string {
  return JSON.stringify(createWhiteboardDocument(snapshot));
}

export function deserializeWhiteboardSnapshot(serialized: string): WhiteboardSnapshot | null {
  try {
    const parsed = JSON.parse(serialized);
    return readWhiteboardDocument(parsed) ?? readLegacyWhiteboardSnapshot(parsed);
  } catch {
    return null;
  }
}

export function normalizeWhiteboardSnapshot(value: unknown): WhiteboardSnapshot {
  if (!isRecord(value)) return emptySnapshot();
  const elements = readElements(value.elements);
  const elementIds = new Set(elements.map((element) => element.id));
  return {
    connectors: readConnectors(value.connectors, elementIds),
    elements,
    ruler: readRuler(value.ruler),
    strokes: readStrokes(value.strokes),
    viewport: readViewport(value.viewport) ?? { ...WHITEBOARD_INITIAL_VIEWPORT },
  };
}

function readWhiteboardDocument(value: unknown): WhiteboardSnapshot | null {
  if (
    !isRecord(value) ||
    value.format !== WHITEBOARD_DOCUMENT_FORMAT ||
    value.version !== WHITEBOARD_DOCUMENT_VERSION
  ) {
    return null;
  }
  return normalizeWhiteboardSnapshot(value.content);
}

function readLegacyWhiteboardSnapshot(value: unknown): WhiteboardSnapshot | null {
  if (!isRecord(value)) return null;
  if (!('elements' in value) && !('strokes' in value) && !('connectors' in value) && !('viewport' in value)) {
    return null;
  }
  return normalizeWhiteboardSnapshot(value);
}

function emptySnapshot(): WhiteboardSnapshot {
  return {
    connectors: [...WHITEBOARD_SEED_CONNECTORS],
    elements: [...WHITEBOARD_SEED_ELEMENTS],
    strokes: [...WHITEBOARD_SEED_STROKES],
    viewport: { ...WHITEBOARD_INITIAL_VIEWPORT },
  };
}

function readElements(value: unknown): WhiteboardElement[] {
  if (!Array.isArray(value)) return [...WHITEBOARD_SEED_ELEMENTS];
  return value.flatMap((item) => {
    const element = readElement(item);
    return element ? [element] : [];
  });
}

function readElement(value: unknown): WhiteboardElement | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const type = readElementType(value.type);
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const width = readPositiveNumber(value.width);
  const height = readPositiveNumber(value.height);
  const text = typeof value.text === 'string' ? value.text : '';
  if (!id || !type || x === null || y === null || width === null || height === null) return null;
  const element = resizeWhiteboardElement({ height, id, text, type, width, x, y }, width, height);
  if (type !== 'image') return element;
  return {
    ...element,
    ...(isSafeImageAssetPath(value.imageAssetPath) ? { imageAssetPath: value.imageAssetPath } : {}),
    ...(typeof value.imageSrc === 'string' ? { imageSrc: value.imageSrc } : {}),
  };
}

function readConnectors(value: unknown, elementIds: Set<string>): WhiteboardConnector[] {
  if (!Array.isArray(value)) return [...WHITEBOARD_SEED_CONNECTORS];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const fromId = readString(item.fromId);
    const toId = readString(item.toId);
    if (!id || !fromId || !toId || !elementIds.has(fromId) || !elementIds.has(toId)) return [];
    return [{ id, fromId, toId }];
  });
}

function readStrokes(value: unknown): WhiteboardStroke[] {
  if (!Array.isArray(value)) return [...WHITEBOARD_SEED_STROKES];
  return value.flatMap((item) => {
    const stroke = readStroke(item);
    return stroke ? [stroke] : [];
  });
}

function readStroke(value: unknown): WhiteboardStroke | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const tool = readDrawingTool(value.tool);
  const color = readString(value.color);
  const size = readPositiveNumber(value.size) ?? 1;
  const points = readStrokePoints(value.points);
  if (!id || !tool || !color || points.length === 0) return null;
  return { color, id, points, size, tool };
}

function encodeStroke(stroke: WhiteboardStroke): WhiteboardDocumentStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => (
      point.breakBefore
        ? [point.x, point.y, point.pressure, true]
        : [point.x, point.y, point.pressure]
    )),
  };
}

function encodeElement(element: WhiteboardElement): WhiteboardElement {
  if (element.type !== 'image' || !element.imageAssetPath) return element;
  const storedElement = { ...element };
  delete storedElement.imageSrc;
  return storedElement;
}

function isSafeImageAssetPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('assets/')) return false;
  const fileName = value.slice('assets/'.length);
  return fileName.length > 0 && !fileName.includes('/') && !fileName.includes('\\') && fileName !== '.' && fileName !== '..';
}

function readStrokePoints(value: unknown): WhiteboardStrokePoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const x = Array.isArray(item) ? readFiniteNumber(item[0]) : isRecord(item) ? readFiniteNumber(item.x) : null;
    const y = Array.isArray(item) ? readFiniteNumber(item[1]) : isRecord(item) ? readFiniteNumber(item.y) : null;
    const pressure = Array.isArray(item) ? readFiniteNumber(item[2]) : isRecord(item) ? readFiniteNumber(item.pressure) : null;
    if (x === null || y === null || pressure === null) return [];
    const point = {
      pressure: Math.min(1, Math.max(0, pressure)),
      x,
      y,
    };
    const breakBefore = Array.isArray(item) ? item[3] === true : isRecord(item) && item.breakBefore === true;
    return breakBefore ? [{ ...point, breakBefore: true }] : [point];
  });
}

function readViewport(value: unknown): WhiteboardViewport | null {
  if (!isRecord(value)) return null;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const zoom = readPositiveNumber(value.zoom);
  if (x === null || y === null || zoom === null) return null;
  return { x, y, zoom: clampWhiteboardZoom(zoom) };
}

function readRuler(value: unknown): WhiteboardRulerSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  const angle = readFiniteNumber(value.angle);
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  if (angle === null || x === null || y === null) return undefined;
  return { angle, visible: value.visible === true, x, y };
}

function readElementType(value: unknown): WhiteboardElementType | null {
  return typeof value === 'string' && elementTypes.has(value as WhiteboardElementType)
    ? value as WhiteboardElementType
    : null;
}

function readDrawingTool(value: unknown): WhiteboardDrawingTool | null {
  return typeof value === 'string' && drawingTools.has(value as WhiteboardDrawingTool)
    ? value as WhiteboardDrawingTool
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPositiveNumber(value: unknown): number | null {
  const number = readFiniteNumber(value);
  return number !== null && number > 0 ? number : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
