import { createRoot } from 'react-dom/client';
import {
  themeColorTokens,
  themeDomStyleTokens,
  themeExportLayoutTokens,
  themeStyleResetTokens,
} from '@/styles/themeTokens';
import { NoteExportDocument } from './NoteExportDocument';
import { EXPORT_DOCUMENT_CSS, EXPORT_WIDTH_PX } from './noteExportHtmlStyles';

const MAX_EXPORT_IMAGE_DECODE_WAIT_COUNT = 200;
export const MAX_EXPORT_IMAGE_DECODE_SCAN_ELEMENTS = 20_000;
export const MAX_EXPORT_IMAGE_DECODE_CONCURRENCY = 8;
export { NoteExportDocument } from './NoteExportDocument';

interface ExportImageVisit {
  element: Element;
  depth: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function collectExportDecodeWaitImages(container: HTMLElement): HTMLImageElement[] {
  const images: HTMLImageElement[] = [];
  const firstElement = container.firstElementChild;
  if (!firstElement) {
    return images;
  }

  const stack: ExportImageVisit[] = [{ element: firstElement, depth: 1 }];
  let scannedElements = 0;
  while (
    stack.length > 0 &&
    images.length < MAX_EXPORT_IMAGE_DECODE_WAIT_COUNT &&
    scannedElements < MAX_EXPORT_IMAGE_DECODE_SCAN_ELEMENTS
  ) {
    const { element, depth } = stack.pop() as ExportImageVisit;
    scannedElements += 1;
    if (element instanceof HTMLImageElement) {
      images.push(element);
    }

    const nextElement = element.nextElementSibling;
    if (nextElement) {
      stack.push({ element: nextElement, depth });
    }

    const firstChild = element.firstElementChild;
    if (firstChild) {
      stack.push({ element: firstChild, depth: depth + 1 });
    }
  }

  return images;
}

async function waitForExportRender(container: HTMLElement): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  const images = collectExportDecodeWaitImages(container);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(MAX_EXPORT_IMAGE_DECODE_CONCURRENCY, images.length) },
    async () => {
      while (nextIndex < images.length) {
        const image = images[nextIndex]!;
        nextIndex += 1;
        if (image.complete) {
          continue;
        }
        try {
          await image.decode();
        } catch {
          // Export should still continue if a remote/local image cannot be decoded.
        }
      }
    },
  );
  await Promise.all(workers);
}

export async function renderNoteExportElement(markdown: string, title: string): Promise<{
  element: HTMLElement;
  cleanup: () => void;
}> {
  const host = document.createElement('div');
  host.style.position = themeDomStyleTokens.positionAbsolute;
  host.style.left = themeExportLayoutTokens.hiddenHostLeft;
  host.style.top = themeExportLayoutTokens.hiddenHostTop;
  host.style.width = `${EXPORT_WIDTH_PX}px`;
  host.style.background = themeColorTokens.exportSurface;
  host.style.pointerEvents = themeStyleResetTokens.pointerEventsNone;
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = EXPORT_DOCUMENT_CSS;
  host.appendChild(style);

  const mount = document.createElement('div');
  host.appendChild(mount);

  let root: ReturnType<typeof createRoot> | null = null;
  try {
    root = createRoot(mount);
    root.render(<NoteExportDocument markdown={markdown} title={title} />);
    await waitForExportRender(host);

    const element = host.querySelector('.note-export') as HTMLElement | null;
    if (!element) {
      throw new Error('Failed to render export document.');
    }

    return {
      element,
      cleanup: () => {
        root?.unmount();
        host.remove();
      },
    };
  } catch (error) {
    root?.unmount();
    host.remove();
    throw error;
  }
}

export async function renderNoteExportHtml(markdown: string, title: string): Promise<string> {
  const { element, cleanup } = await renderNoteExportElement(markdown, title);
  try {
    return [
      '<!doctype html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      `<title>${escapeHtml(title)}</title>`,
      `<style>${EXPORT_DOCUMENT_CSS}</style>`,
      '</head>',
      '<body>',
      element.outerHTML,
      '</body>',
      '</html>',
    ].join('');
  } finally {
    cleanup();
  }
}
