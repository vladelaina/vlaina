import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import {
  READONLY_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import {
  createMarkdownSanitizeSchema,
  isRenderableDataImageSrc,
  rehypeImageSrcSanitizer,
  rehypeImageSrcsetSanitizer,
  rehypeRawHtmlUrlSanitizer,
} from '@/components/common/markdown/imagePolicy';
import { KATEX_SHARED_RENDER_OPTIONS } from '@/components/common/markdown/katexOptions';
import { rehypeKatexSourceSanitizer } from '@/components/common/markdown/katexSourceSanitizer';
import { rehypeDropUnsafeRawHtmlContent } from '@/components/common/markdown/rawHtmlSanitizer';
import { normalizeImageWidth, serializeCropValue } from '@/components/common/markdown/imageSourceFragment';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import {
  themeColorTokens,
  themeDomStyleTokens,
  themeExportLayoutTokens,
  themeStyleResetTokens,
} from '@/styles/themeTokens';
import {
  getNoteInternalImageAssetPath,
  isLocalNetworkHttpUrl,
  isPublicRemoteMediaUrl,
  sanitizeNoteLinkHref,
  sanitizeNoteMediaSrc,
} from '@/lib/notes/markdown/urlSecurity';
import { cn } from '@/lib/utils';
import { EXPORT_DOCUMENT_CSS, EXPORT_WIDTH_PX } from './noteExportHtmlStyles';

const BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();
const EXPORT_BLOCKED_LOADABLE_RAW_HTML_TAGS = new Set(['audio', 'iframe', 'track', 'video']);
const MAX_EXPORT_IMAGE_DECODE_WAIT_COUNT = 200;
export const MAX_EXPORT_IMAGE_DECODE_SCAN_ELEMENTS = 20_000;
export const MAX_EXPORT_IMAGE_DECODE_CONCURRENCY = 8;

const NOTE_EXPORT_MARKDOWN_SANITIZE_SCHEMA = {
  ...BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA,
  tagNames: (BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA.tagNames || []).filter(
    (tagName: string) => !EXPORT_BLOCKED_LOADABLE_RAW_HTML_TAGS.has(tagName),
  ),
  protocols: {
    ...(BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA.protocols || {}),
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
};

const NOTE_EXPORT_REHYPE_PLUGINS = [
  rehypeDropUnsafeRawHtmlContent,
  rehypeRaw,
  rehypeDropUnsafeRawHtmlContent,
  rehypeImageSrcSanitizer,
  [rehypeSanitize, NOTE_EXPORT_MARKDOWN_SANITIZE_SCHEMA],
  rehypeRawHtmlUrlSanitizer,
  rehypeImageSrcsetSanitizer,
  [rehypeKatex, KATEX_SHARED_RENDER_OPTIONS],
  rehypeKatexSourceSanitizer,
] as any[];

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

function sanitizeExportLinkHref(value: unknown): string | null {
  const safeHref = sanitizeNoteLinkHref(value);
  if (!safeHref) {
    return null;
  }

  if (safeHref.startsWith('/')) {
    return null;
  }

  if (/^https?:/i.test(safeHref) && isLocalNetworkHttpUrl(safeHref)) {
    return null;
  }

  return safeHref;
}

function renderExportLink(props: any) {
  const safeHref = sanitizeExportLinkHref(props.href);
  if (!safeHref) {
    return <>{props.children}</>;
  }

  return (
    <a href={safeHref}>
      {props.children}
    </a>
  );
}

function renderExportImage(props: any) {
  const rawSrc = typeof props.src === 'string' ? props.src.trim() : '';
  const safeWidth = normalizeImageWidth(typeof props.width === 'number' ? `${props.width}px` : props.width);
  const rawCrop = props.dataVlainaCrop ?? props['data-vlaina-crop'];
  const safeCrop = serializeCropValue(rawCrop);
  const align = props.align === 'left' || props.align === 'right' || props.align === 'center'
    ? props.align
    : undefined;
  const imageStyle: React.CSSProperties = {
    ...(safeWidth ? { width: safeWidth } : {}),
    ...(align === 'center' ? { display: 'block', marginLeft: 'auto', marginRight: 'auto' } : {}),
    ...(align === 'right' ? { display: 'block', marginLeft: 'auto' } : {}),
  };
  if (isRenderableDataImageSrc(rawSrc)) {
    return (
      <img
        src={rawSrc}
        alt={props.alt ?? ''}
        title={props.title}
        style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
        data-vlaina-crop={safeCrop ?? undefined}
      />
    );
  }

  const safeSrc = sanitizeNoteMediaSrc(rawSrc);
  const localSrc = getNoteInternalImageAssetPath(safeSrc) ?? safeSrc;
  if (
    !safeSrc
    || /^blob:/i.test(safeSrc)
    || isPublicRemoteMediaUrl(safeSrc)
    || hasInternalNoteAssetUrlPathSegment(localSrc)
  ) {
    return null;
  }

  return (
    <img
      src={safeSrc}
      alt={props.alt ?? ''}
      title={props.title}
      style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
      data-vlaina-crop={safeCrop ?? undefined}
    />
  );
}

function transformExportUrl(value: string, key: string): string {
  if (key === 'href') {
    return sanitizeExportLinkHref(value) ?? '';
  }
  return value;
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

export function NoteExportDocument({
  markdown,
  title,
  className,
}: {
  markdown: string;
  title: string;
  className?: string;
}) {
  return (
    <article className={cn('note-export', className)}>
      <h1 className="note-export-title">{title}</h1>
      <div className="note-export-body">
        <ReactMarkdown
          remarkPlugins={READONLY_MARKDOWN_REMARK_PLUGINS}
          rehypePlugins={NOTE_EXPORT_REHYPE_PLUGINS}
          urlTransform={transformExportUrl}
          components={{
            a: renderExportLink,
            img: renderExportImage,
            source: () => null,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
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

  const root = createRoot(mount);
  root.render(<NoteExportDocument markdown={markdown} title={title} />);
  await waitForExportRender(host);

  const element = host.querySelector('.note-export') as HTMLElement | null;
  if (!element) {
    root.unmount();
    host.remove();
    throw new Error('Failed to render export document.');
  }

  return {
    element,
    cleanup: () => {
      root.unmount();
      host.remove();
    },
  };
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
