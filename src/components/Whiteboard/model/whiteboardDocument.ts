import {
  WHITEBOARD_INITIAL_VIEWPORT,
  WHITEBOARD_SEED_ELEMENTS,
  WHITEBOARD_SEED_STROKES,
  clampWhiteboardZoom,
  resizeWhiteboardElement,
  type WhiteboardDrawingTool,
  type WhiteboardElement,
  type WhiteboardPaperStyle,
  type WhiteboardStroke,
  type WhiteboardStrokePoint,
  type WhiteboardViewport,
} from './whiteboardModel';
import { splitWhiteboardStrokeSegments } from './whiteboardStrokeSegments';

export const WHITEBOARD_DOCUMENT_FORMAT = 'vlaina.whiteboard';
export const WHITEBOARD_DOCUMENT_MIME_TYPE = 'application/vnd.vlaina.whiteboard+json';
export const WHITEBOARD_DOCUMENT_VERSION = 1;

export interface WhiteboardSnapshot {
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
  viewport: WhiteboardViewport;
  paper?: WhiteboardPaperStyle;
}

type StoredStrokePoint = [number, number, number] | [number, number, number, true];
interface StoredStroke extends Omit<WhiteboardStroke, 'points'> { points: StoredStrokePoint[] }
interface StoredContent extends Omit<WhiteboardSnapshot, 'strokes'> { strokes: StoredStroke[] }
export interface WhiteboardDocumentV1 {
  content: StoredContent;
  format: typeof WHITEBOARD_DOCUMENT_FORMAT;
  version: typeof WHITEBOARD_DOCUMENT_VERSION;
}

type JsonRecord = Record<string, unknown>;
const paperStyles = new Set<WhiteboardPaperStyle>(['blank', 'dots', 'grid', 'ruled']);
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
    const value = JSON.parse(serialized);
    if (!isRecord(value) || value.format !== WHITEBOARD_DOCUMENT_FORMAT || value.version !== WHITEBOARD_DOCUMENT_VERSION) return null;
    return normalizeSnapshot(value.content, false);
  } catch {
    return null;
  }
}

export function normalizeWhiteboardSnapshot(value: unknown): WhiteboardSnapshot {
  return normalizeSnapshot(value, true);
}

function normalizeSnapshot(value: unknown, runtimePoints: boolean): WhiteboardSnapshot {
  if (!isRecord(value)) return emptySnapshot();
  return {
    elements: readElements(value.elements),
    ...(typeof value.paper === 'string' && paperStyles.has(value.paper as WhiteboardPaperStyle) ? { paper: value.paper as WhiteboardPaperStyle } : {}),
    strokes: readStrokes(value.strokes, runtimePoints),
    viewport: readViewport(value.viewport) ?? { ...WHITEBOARD_INITIAL_VIEWPORT },
  };
}

function emptySnapshot(): WhiteboardSnapshot {
  return { elements: [...WHITEBOARD_SEED_ELEMENTS], strokes: [...WHITEBOARD_SEED_STROKES], viewport: { ...WHITEBOARD_INITIAL_VIEWPORT } };
}

function readElements(value: unknown): WhiteboardElement[] {
  if (!Array.isArray(value)) return [...WHITEBOARD_SEED_ELEMENTS];
  return value.flatMap((item) => {
    if (!isRecord(item) || !isElementType(item.type)) return [];
    const id = readString(item.id);
    const x = readFiniteNumber(item.x);
    const y = readFiniteNumber(item.y);
    const width = readPositiveNumber(item.width);
    const height = readPositiveNumber(item.height);
    if (!id || x === null || y === null || width === null || height === null) return [];
    return [resizeWhiteboardElement({
      height, id, text: typeof item.text === 'string' ? item.text : '', type: item.type, width, x, y,
      ...(isSafeImageAssetPath(item.imageAssetPath) ? { imageAssetPath: item.imageAssetPath } : {}),
      ...(typeof item.imageSrc === 'string' ? { imageSrc: item.imageSrc } : {}),
    }, width, height)];
  });
}

function readStrokes(value: unknown, runtimePoints: boolean): WhiteboardStroke[] {
  if (!Array.isArray(value)) return [...WHITEBOARD_SEED_STROKES];
  const strokes = value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = readString(item.id);
    const tool = typeof item.tool === 'string' && drawingTools.has(item.tool as WhiteboardDrawingTool) ? item.tool as WhiteboardDrawingTool : null;
    const color = readString(item.color);
    const size = readPositiveNumber(item.size);
    const points = readStrokePoints(item.points, runtimePoints);
    return id && tool && color && size !== null && points.length > 0 ? [{ color, id, points, size, tool }] : [];
  });
  return splitWhiteboardStrokeSegments(strokes);
}

function readStrokePoints(value: unknown, runtimePoints: boolean): WhiteboardStrokePoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!Array.isArray(item) && (!runtimePoints || !isRecord(item))) return [];
    const x = readFiniteNumber(Array.isArray(item) ? item[0] : item.x);
    const y = readFiniteNumber(Array.isArray(item) ? item[1] : item.y);
    const pressure = readFiniteNumber(Array.isArray(item) ? item[2] : item.pressure);
    if (x === null || y === null || pressure === null) return [];
    const point = { pressure: Math.min(1, Math.max(0, pressure)), x, y };
    const breakBefore = Array.isArray(item) ? item[3] === true : item.breakBefore === true;
    return breakBefore ? [{ ...point, breakBefore: true }] : [point];
  });
}

function encodeStroke(stroke: WhiteboardStroke): StoredStroke {
  return { ...stroke, points: stroke.points.map((point) => point.breakBefore ? [point.x, point.y, point.pressure, true] : [point.x, point.y, point.pressure]) };
}

function encodeElement(element: WhiteboardElement): WhiteboardElement {
  if (element.type !== 'image' || !element.imageAssetPath) return element;
  const stored = { ...element };
  delete stored.imageSrc;
  return stored;
}

function isElementType(value: unknown): value is WhiteboardElement['type'] {
  return value === 'image';
}

function readViewport(value: unknown): WhiteboardViewport | null {
  if (!isRecord(value)) return null;
  const x = readFiniteNumber(value.x);
  const y = readFiniteNumber(value.y);
  const zoom = readPositiveNumber(value.zoom);
  return x === null || y === null || zoom === null ? null : { x, y, zoom: clampWhiteboardZoom(zoom) };
}

function isSafeImageAssetPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('assets/')) return false;
  const fileName = value.slice('assets/'.length);
  return fileName.length > 0 && !fileName.includes('/') && !fileName.includes('\\') && fileName !== '.' && fileName !== '..';
}

function readString(value: unknown): string | null { return typeof value === 'string' && value.length > 0 ? value : null; }
function readFiniteNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function readPositiveNumber(value: unknown): number | null { const number = readFiniteNumber(value); return number !== null && number > 0 ? number : null; }
function isRecord(value: unknown): value is JsonRecord { return typeof value === 'object' && value !== null && !Array.isArray(value); }
