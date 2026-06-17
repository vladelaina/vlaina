import { getElectronBridge } from '@/lib/electron/bridge';
import { writeDesktopBinaryFile } from '@/lib/desktop/fs';
import { saveDialog } from '@/lib/storage/dialog';
import { translate } from '@/lib/i18n';
import { getBase64DecodedByteLength } from '@/lib/markdown/dataImagePolicy';
import { sanitizeSvgMarkup } from '@/lib/markdown/svgSanitizer';
import { toBlobPart } from '@/lib/blobPart';
import { themeColorTokens } from '@/styles/themeTokens';

export type PreviewExportFormat = 'svg' | 'png' | 'jpg';

export const PREVIEW_EXPORT_LABELS: Record<PreviewExportFormat, string> = {
  svg: 'SVG',
  png: 'PNG',
  jpg: 'JPG',
};
export const MAX_PREVIEW_EXPORT_BYTES = 50 * 1024 * 1024;

const EXPORT_MIME_TYPES: Record<PreviewExportFormat, string> = {
  svg: 'image/svg+xml;charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
};
const EXPORT_PRIMARY_MIME_TYPES: Record<PreviewExportFormat, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
};

const EXPORT_FILTERS: Record<PreviewExportFormat, { name: string; extensions: string[] }[]> = {
  svg: [{ name: 'SVG Image', extensions: ['svg'] }],
  png: [{ name: 'PNG Image', extensions: ['png'] }],
  jpg: [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }],
};

function dataUrlToBytes(dataUrl: string, format: PreviewExportFormat): Uint8Array {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) {
    throw new Error('Invalid preview export data URL.');
  }

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  const mediaType = /^data:([^;,]+)/i.exec(metadata)?.[1]?.toLowerCase() ?? '';
  if (mediaType !== EXPORT_PRIMARY_MIME_TYPES[format]) {
    throw new Error('Unexpected preview export MIME type.');
  }

  if (/(?:^|;)base64(?:;|$)/i.test(metadata)) {
    const byteLength = getBase64DecodedByteLength(payload);
    if (byteLength === null) {
      throw new Error('Invalid preview export data URL.');
    }
    if (byteLength > MAX_PREVIEW_EXPORT_BYTES) {
      throw new Error('Preview export output is too large.');
    }
    const binary = atob(payload);
    if (binary.length > MAX_PREVIEW_EXPORT_BYTES) {
      throw new Error('Preview export output is too large.');
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  if (payload.length > MAX_PREVIEW_EXPORT_BYTES * 3) {
    throw new Error('Preview export output is too large.');
  }
  const bytes = new TextEncoder().encode(decodeURIComponent(payload));
  if (bytes.byteLength > MAX_PREVIEW_EXPORT_BYTES) {
    throw new Error('Preview export output is too large.');
  }
  return bytes;
}

function assertPreviewExportBytes(byteLength: number): void {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_PREVIEW_EXPORT_BYTES) {
    throw new Error('Preview export output is too large.');
  }
}

function svgMarkupToBytes(markup: string): Uint8Array {
  const sanitized = sanitizeSvgMarkup(markup);
  if (!sanitized) {
    throw new Error('Preview SVG export is empty after sanitization.');
  }
  const bytes = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${sanitized}`);
  assertPreviewExportBytes(bytes.byteLength);
  return bytes;
}

function downloadInBrowser(fileName: string, bytes: Uint8Array, mimeType: string) {
  const blob = new Blob([toBlobPart(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ensureExtension(filePath: string, format: PreviewExportFormat) {
  const extensions = EXPORT_FILTERS[format][0].extensions;
  const lowerPath = filePath.toLowerCase();
  return extensions.some((extension) => lowerPath.endsWith(`.${extension}`))
    ? filePath
    : `${filePath}.${format}`;
}

function serializeExistingSvg(element: HTMLElement): Uint8Array | null {
  const svg = element.querySelector('svg');
  if (!svg) {
    return null;
  }

  const clone = svg.cloneNode(true) as SVGElement;
  if (clone.namespaceURI !== 'http://www.w3.org/2000/svg' && !clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const source = new XMLSerializer().serializeToString(clone);
  return svgMarkupToBytes(source);
}

async function createPreviewBytes(element: HTMLElement, format: PreviewExportFormat): Promise<Uint8Array> {
  const { toJpeg, toPng, toSvg } = await import('html-to-image');

  if (format === 'svg') {
    const existingSvg = serializeExistingSvg(element);
    if (existingSvg) {
      return existingSvg;
    }
    return svgMarkupToBytes(new TextDecoder().decode(dataUrlToBytes(await toSvg(element, { cacheBust: true }), format)));
  }

  const options = {
    backgroundColor: themeColorTokens.exportSurface,
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };

  return dataUrlToBytes(
    format === 'png'
      ? await toPng(element, options)
      : await toJpeg(element, { ...options, quality: 0.95 }),
    format
  );
}

export async function savePreview(element: HTMLElement, fileBaseName: string, format: PreviewExportFormat) {
  const bytes = await createPreviewBytes(element, format);
  const defaultPath = `${fileBaseName}.${format}`;
  const selectedPath = await saveDialog({
    title: translate('editor.preview.saveAsFormat', { format: PREVIEW_EXPORT_LABELS[format] }),
    defaultPath,
    filters: EXPORT_FILTERS[format],
  });

  if (!selectedPath) {
    if (!getElectronBridge()) {
      downloadInBrowser(defaultPath, bytes, EXPORT_MIME_TYPES[format]);
    }
    return;
  }

  await writeDesktopBinaryFile(ensureExtension(selectedPath, format), bytes);
}
