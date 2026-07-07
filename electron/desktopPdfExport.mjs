import electron from 'electron';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { app, BrowserWindow } = electron;
const MAX_DESKTOP_EXPORT_HTML_BYTES = 64 * 1024 * 1024;
const MAX_DESKTOP_EXPORT_PDF_BYTES = 64 * 1024 * 1024;

function assertDesktopExportHtmlBytes(html) {
  if (Buffer.byteLength(html, 'utf8') > MAX_DESKTOP_EXPORT_HTML_BYTES) {
    throw new Error('PDF export HTML is too large.');
  }
}

function assertDesktopExportPdfBytes(byteLength) {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > MAX_DESKTOP_EXPORT_PDF_BYTES) {
    throw new Error('PDF export output is too large.');
  }
}

function normalizeExportPdfOptions(options) {
  const pageSize = options?.pageSize === 'Letter' ? 'Letter' : 'A4';
  return {
    landscape: Boolean(options?.landscape),
    pageSize,
    printBackground: true,
    margins: {
      marginType: 'custom',
      top: 0.4,
      bottom: 0.45,
      left: 0.45,
      right: 0.45,
    },
  };
}

export async function renderHtmlToPdf(html, options) {
  if (typeof html !== 'string' || !html.trim()) {
    throw new Error('HTML content is required for PDF export.');
  }
  assertDesktopExportHtmlBytes(html);

  const tempDir = await mkdtemp(path.join(app.getPath('temp'), 'vlaina-export-'));
  const tempHtmlPath = path.join(tempDir, 'export.html');

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    await writeFile(tempHtmlPath, html, 'utf8');
    await win.loadFile(tempHtmlPath);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const pdfBytes = await win.webContents.printToPDF(normalizeExportPdfOptions(options));
    assertDesktopExportPdfBytes(pdfBytes?.byteLength);
    return pdfBytes;
  } finally {
    if (!win.isDestroyed()) {
      win.destroy();
    }
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
