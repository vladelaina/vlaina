import { themeWhiteboardTokens } from '@/styles/themeTokens';
import {
  WHITEBOARD_BRUSHES,
  getStrokeWidth,
  getWhiteboardElementCenter,
  type WhiteboardConnector,
  type WhiteboardElement,
  type WhiteboardStroke,
} from './whiteboardModel';
import { getStrokeBounds } from './whiteboardSelection';
import { getPressureStrokePath, getStrokeRenderWidth } from './whiteboardStrokeGeometry';

interface WhiteboardExportOptions {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  root: HTMLElement | null;
  strokes: WhiteboardStroke[];
}

export async function exportWhiteboardPng({
  connectors,
  elements,
  root,
  strokes,
}: WhiteboardExportOptions) {
  const styles = root ? window.getComputedStyle(root) : document.documentElement.style;
  const bounds = getExportBounds(elements, strokes);
  const svg = buildExportSvg({ bounds, connectors, elements, strokes, styles });
  const image = await loadSvgImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = bounds.width;
  canvas.height = bounds.height;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
  link.click();
  URL.revokeObjectURL(url);
}

interface BuildExportSvgOptions {
  bounds: ExportBounds;
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
  styles: CSSStyleDeclaration;
}

function buildExportSvg({
  bounds,
  connectors,
  elements,
  strokes,
  styles,
}: BuildExportSvgOptions) {
  const background = css(styles, '--vlaina-color-whiteboard-canvas');
  const connectorColor = css(styles, '--vlaina-color-whiteboard-connector');
  const elementColor = css(styles, '--vlaina-color-whiteboard-shape');
  const elementBorder = css(styles, '--vlaina-color-whiteboard-shape-border');
  const noteColor = css(styles, '--vlaina-color-whiteboard-note');
  const noteBorder = css(styles, '--vlaina-color-whiteboard-note-border');
  const textColor = css(styles, '--vlaina-color-text-primary');
  const elementsById = new Map(elements.map((element) => [element.id, element]));
  const content = [
    `<rect width="100%" height="100%" fill="${escapeAttr(background)}"/>`,
    `<g transform="translate(${-bounds.x} ${-bounds.y})">${strokes.map((stroke) => renderStroke(stroke)).join('')}</g>`,
    ...connectors.flatMap((connector) => {
      const from = elementsById.get(connector.fromId);
      const to = elementsById.get(connector.toId);
      if (!from || !to) return [];
      return [renderConnector(from, to, bounds, connectorColor)];
    }),
    ...elements.map((element) => renderElement(element, bounds, {
      elementBorder, elementColor, noteBorder, noteColor, textColor,
    })),
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">${content}</svg>`;
}

function renderStroke(stroke: WhiteboardStroke): string {
  if (stroke.points.length === 0) return '';
  const brush = WHITEBOARD_BRUSHES[stroke.tool];
  const color = escapeAttr(stroke.color || brush.color);
  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    return `<circle cx="${point.x}" cy="${point.y}" r="${getStrokeRenderWidth(stroke) / 2}" fill="${color}" opacity="${brush.opacity}"/>`;
  }
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  return `<g opacity="${brush.opacity}"><path d="${getPressureStrokePath(stroke)}" fill="${color}"/><circle cx="${first.x}" cy="${first.y}" r="${getStrokeWidth(stroke.tool, first.pressure, stroke.size) / 2}" fill="${color}"/><circle cx="${last.x}" cy="${last.y}" r="${getStrokeWidth(stroke.tool, last.pressure, stroke.size) / 2}" fill="${color}"/></g>`;
}

function renderConnector(from: WhiteboardElement, to: WhiteboardElement, bounds: ExportBounds, color: string): string {
  const start = getWhiteboardElementCenter(from);
  const end = getWhiteboardElementCenter(to);
  return `<line x1="${start.x - bounds.x}" y1="${start.y - bounds.y}" x2="${end.x - bounds.x}" y2="${end.y - bounds.y}" stroke="${escapeAttr(color)}" stroke-linecap="round" stroke-width="${themeWhiteboardTokens.connectorStrokeWidthPx}"/>`;
}

function renderElement(element: WhiteboardElement, bounds: ExportBounds, colors: Record<string, string>): string {
  const x = element.x - bounds.x;
  const y = element.y - bounds.y;
  if (element.type === 'image' && element.imageSrc) {
    return `<image href="${escapeAttr(element.imageSrc)}" x="${x}" y="${y}" width="${element.width}" height="${element.height}" preserveAspectRatio="xMidYMid slice"/>`;
  }
  const fill = element.type === 'note' ? colors.noteColor : colors.elementColor;
  const stroke = element.type === 'note' ? colors.noteBorder : colors.elementBorder;
  const shape = element.type === 'ellipse'
    ? `<ellipse cx="${x + element.width / 2}" cy="${y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${escapeAttr(fill)}" stroke="${escapeAttr(stroke)}"/>`
    : `<rect x="${x}" y="${y}" width="${element.width}" height="${element.height}" rx="${themeWhiteboardTokens.exportElementRadiusPx}" fill="${escapeAttr(fill)}" stroke="${escapeAttr(stroke)}"/>`;
  const text = renderElementText(element, x, y, colors.textColor);
  return `${shape}${text}`;
}

function renderElementText(element: WhiteboardElement, x: number, y: number, color: string): string {
  const lines = element.text.split('\n').slice(0, themeWhiteboardTokens.exportMaxTextLines);
  const startY = y + element.height / 2 - ((lines.length - 1) * themeWhiteboardTokens.exportTextLineHeightPx) / 2;
  return `<text x="${x + element.width / 2}" y="${startY}" fill="${escapeAttr(color)}" font-size="${themeWhiteboardTokens.exportFontSizePx}" font-family="sans-serif" font-weight="600" text-anchor="middle" dominant-baseline="middle">${lines.map((line, index) => `<tspan x="${x + element.width / 2}" dy="${index === 0 ? 0 : themeWhiteboardTokens.exportTextLineHeightPx}">${escapeText(line)}</tspan>`).join('')}</text>`;
}

interface ExportBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

function getExportBounds(elements: WhiteboardElement[], strokes: WhiteboardStroke[]): ExportBounds {
  const strokeBounds = strokes.flatMap((stroke) => {
    const bounds = getStrokeBounds(stroke);
    return bounds ? [bounds] : [];
  });
  const elementBounds = elements.map((element) => ({ height: element.height, width: element.width, x: element.x, y: element.y }));
  const allBounds = [...strokeBounds, ...elementBounds];
  if (allBounds.length === 0) {
    return { height: themeWhiteboardTokens.exportEmptyHeightPx, width: themeWhiteboardTokens.exportEmptyWidthPx, x: 0, y: 0 };
  }
  const padding = themeWhiteboardTokens.exportPaddingPx;
  const minX = Math.min(...allBounds.map((bounds) => bounds.x)) - padding;
  const minY = Math.min(...allBounds.map((bounds) => bounds.y)) - padding;
  const maxX = Math.max(...allBounds.map((bounds) => bounds.x + bounds.width)) + padding;
  const maxY = Math.max(...allBounds.map((bounds) => bounds.y + bounds.height)) + padding;
  return { height: Math.ceil(maxY - minY), width: Math.ceil(maxX - minX), x: minX, y: minY };
}

async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Whiteboard export failed'));
    image.src = url;
  });
  URL.revokeObjectURL(url);
  return image;
}

function css(styles: CSSStyleDeclaration, name: string): string {
  return styles.getPropertyValue(name).trim();
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
