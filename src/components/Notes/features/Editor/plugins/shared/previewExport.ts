import { toJpeg, toPng, toSvg } from 'html-to-image';
import { getElectronBridge } from '@/lib/electron/bridge';
import { writeDesktopBinaryFile } from '@/lib/desktop/fs';
import { saveDialog } from '@/lib/storage/dialog';
import { translate } from '@/lib/i18n';

export type PreviewExportFormat = 'svg' | 'png' | 'jpg';

export const PREVIEW_EXPORT_LABELS: Record<PreviewExportFormat, string> = {
  svg: 'SVG',
  png: 'PNG',
  jpg: 'JPG',
};

const EXPORT_MIME_TYPES: Record<PreviewExportFormat, string> = {
  svg: 'image/svg+xml;charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
};

const EXPORT_FILTERS: Record<PreviewExportFormat, { name: string; extensions: string[] }[]> = {
  svg: [{ name: 'SVG Image', extensions: ['svg'] }],
  png: [{ name: 'PNG Image', extensions: ['png'] }],
  jpg: [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }],
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const [metadata, payload = ''] = dataUrl.split(',');
  if (metadata.endsWith(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  return new TextEncoder().encode(decodeURIComponent(payload));
}

function downloadInBrowser(fileName: string, bytes: Uint8Array, mimeType: string) {
  const blob = new Blob([bytes], { type: mimeType });
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
  return new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>\n${source}`);
}

async function createPreviewBytes(element: HTMLElement, format: PreviewExportFormat): Promise<Uint8Array> {
  if (format === 'svg') {
    return serializeExistingSvg(element) ?? dataUrlToBytes(await toSvg(element, { cacheBust: true }));
  }

  const options = {
    backgroundColor: '#ffffff',
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  };

  return dataUrlToBytes(
    format === 'png'
      ? await toPng(element, options)
      : await toJpeg(element, { ...options, quality: 0.95 })
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
