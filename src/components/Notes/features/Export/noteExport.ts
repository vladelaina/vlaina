import { toPng } from 'html-to-image';
import { getElectronBridge } from '@/lib/electron/bridge';
import { saveDialog } from '@/lib/storage/dialog';
import { useToastStore } from '@/stores/useToastStore';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { writeDesktopBinaryFile } from '@/lib/desktop/fs';
import { createDocxExportBytes } from './noteExportDocx';
import { renderNoteExportElement, renderNoteExportHtml } from './noteExportHtml';
import { resolveExportMarkdownAssetSources } from './noteExportMarkdown';
import type { NoteExportFormat, NoteExportRequest, NoteExportResult } from './noteExportTypes';

const EXPORT_EXTENSIONS: Record<NoteExportFormat, string> = {
  docx: 'docx',
  html: 'html',
  pdf: 'pdf',
  png: 'png',
};

const EXPORT_FILTERS: Record<NoteExportFormat, { name: string; extensions: string[] }[]> = {
  docx: [{ name: 'Word Document', extensions: ['docx'] }],
  html: [{ name: 'HTML Document', extensions: ['html'] }],
  pdf: [{ name: 'PDF Document', extensions: ['pdf'] }],
  png: [{ name: 'PNG Image', extensions: ['png'] }],
};

function sanitizeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';
}

function ensureExtension(filePath: string, extension: string): string {
  return filePath.toLowerCase().endsWith(`.${extension}`) ? filePath : `${filePath}.${extension}`;
}

function getExportTitle(request: NoteExportRequest): string {
  const title = request.title.trim();
  return title || getNoteTitleFromPath(request.notePath);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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

async function promptExportPath(format: NoteExportFormat, title: string): Promise<string | null> {
  const extension = EXPORT_EXTENSIONS[format];
  const selectedPath = await saveDialog({
    title: `Export as ${extension.toUpperCase()}`,
    defaultPath: `${sanitizeFileName(title)}.${extension}`,
    filters: EXPORT_FILTERS[format],
  });

  return selectedPath ? ensureExtension(selectedPath, extension) : null;
}

async function saveExportBytes(
  format: NoteExportFormat,
  title: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<NoteExportResult> {
  const extension = EXPORT_EXTENSIONS[format];
  const filePath = await promptExportPath(format, title);
  if (!filePath) {
    if (getElectronBridge()) {
      return { canceled: true };
    }

    downloadInBrowser(`${sanitizeFileName(title)}.${extension}`, bytes, mimeType);
    return { canceled: false };
  }

  await writeDesktopBinaryFile(filePath, bytes);
  return { canceled: false, filePath };
}

function htmlToBytes(html: string): Uint8Array {
  return new TextEncoder().encode(html);
}

async function createPngBytes(markdown: string, title: string): Promise<Uint8Array> {
  const { element, cleanup } = await renderNoteExportElement(markdown, title);
  try {
    const dataUrl = await toPng(element, {
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    return dataUrlToBytes(dataUrl);
  } finally {
    cleanup();
  }
}

async function createPdfBytes(html: string): Promise<Uint8Array> {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('PDF export is only available in the desktop app.');
  }

  return bridge.export.htmlToPdf(html, { pageSize: 'A4' });
}

export async function exportNote(request: NoteExportRequest): Promise<NoteExportResult> {
  const title = getExportTitle(request);
  const markdown = await resolveExportMarkdownAssetSources(
    request.markdown,
    request.notesPath,
    request.notePath,
  );

  const html = request.format === 'docx'
    ? null
    : await renderNoteExportHtml(markdown, title);

  const result =
    request.format === 'docx'
      ? await saveExportBytes(
          request.format,
          title,
          await createDocxExportBytes(markdown, title),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
      : request.format === 'html'
        ? await saveExportBytes(request.format, title, htmlToBytes(html ?? ''), 'text/html;charset=utf-8')
        : request.format === 'pdf'
          ? await saveExportBytes(request.format, title, await createPdfBytes(html ?? ''), 'application/pdf')
          : await saveExportBytes(request.format, title, await createPngBytes(markdown, title), 'image/png');

  if (!result.canceled) {
    useToastStore.getState().addToast(`Exported ${title}`, 'success');
  }

  return result;
}

export type { NoteExportFormat, NoteExportRequest, NoteExportResult };
