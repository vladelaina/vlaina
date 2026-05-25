import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import {
  READONLY_MARKDOWN_REMARK_PLUGINS,
} from '@/components/common/markdown/markdownPipeline';
import { createMarkdownSanitizeSchema } from '@/components/common/markdown/imagePolicy';
import { normalizeImageWidth, serializeCropValue } from '@/components/common/markdown/imageSourceFragment';
import { MARKDOWN_BODY_FONT_SIZE } from '@/components/common/markdown/markdownMetrics';
import {
  isPublicRemoteMediaUrl,
  sanitizeNoteLinkHref,
  sanitizeNoteMediaSrc,
} from '@/lib/notes/markdown/urlSecurity';
import { cn } from '@/lib/utils';

const EXPORT_WIDTH_PX = 840;

const EXPORT_CSS = `
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #171717;
    background: #ffffff;
  }
  body {
    margin: 0;
    background: #ffffff;
  }
  .vlaina-note-export {
    box-sizing: border-box;
    width: ${EXPORT_WIDTH_PX}px;
    margin: 0 auto;
    padding: 56px 64px 72px;
    background: #ffffff;
  }
  .vlaina-note-export h1.vlaina-note-export-title {
    margin: 0 0 28px;
    font-size: 34px;
    line-height: 1.16;
    font-weight: 700;
  }
  .vlaina-note-export-body {
    font-size: ${MARKDOWN_BODY_FONT_SIZE}px;
    line-height: 1.72;
    overflow-wrap: anywhere;
  }
  .vlaina-note-export-body h1,
  .vlaina-note-export-body h2,
  .vlaina-note-export-body h3,
  .vlaina-note-export-body h4 {
    margin: 1.5em 0 0.45em;
    line-height: 1.25;
  }
  .vlaina-note-export-body h1 { font-size: 28px; }
  .vlaina-note-export-body h2 { font-size: 23px; }
  .vlaina-note-export-body h3 { font-size: 19px; }
  .vlaina-note-export-body p,
  .vlaina-note-export-body ul,
  .vlaina-note-export-body ol,
  .vlaina-note-export-body blockquote,
  .vlaina-note-export-body pre,
  .vlaina-note-export-body table {
    margin: 0.8em 0;
  }
  .vlaina-note-export-body blockquote {
    border-left: 4px solid #d4d4d4;
    padding-left: 14px;
    color: #525252;
  }
  .vlaina-note-export-body code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.92em;
    background: #f5f5f5;
    border-radius: 4px;
    padding: 0.12em 0.28em;
  }
  .vlaina-note-export-body pre {
    overflow: auto;
    background: #f5f5f5;
    border-radius: 6px;
    padding: 14px 16px;
  }
  .vlaina-note-export-body pre code {
    background: transparent;
    padding: 0;
  }
  .vlaina-note-export-body img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
  }
  .vlaina-note-export-body [data-text-align='center'] {
    text-align: center;
  }
  .vlaina-note-export-body [data-text-align='right'] {
    text-align: right;
  }
  .vlaina-note-export-body table {
    width: 100%;
    border-collapse: collapse;
  }
  .vlaina-note-export-body th,
  .vlaina-note-export-body td {
    border: 1px solid #d4d4d4;
    padding: 7px 9px;
    vertical-align: top;
  }
  .vlaina-note-export-body th {
    background: #f5f5f5;
    font-weight: 600;
  }
  @page {
    margin: 0;
  }
`;

const BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA = createMarkdownSanitizeSchema();

const NOTE_EXPORT_MARKDOWN_SANITIZE_SCHEMA = {
  ...BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA,
  protocols: {
    ...(BASE_EXPORT_MARKDOWN_SANITIZE_SCHEMA.protocols || {}),
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
  },
};

const NOTE_EXPORT_REHYPE_PLUGINS = [
  rehypeRaw,
  [rehypeSanitize, NOTE_EXPORT_MARKDOWN_SANITIZE_SCHEMA],
] as any[];

const SAFE_EXPORT_DATA_IMAGE_PATTERN = /^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderExportLink(props: any) {
  const safeHref = sanitizeNoteLinkHref(props.href);
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
  const safeCrop = serializeCropValue(props.dataVlainaCrop ?? props['data-vlaina-crop']);
  const align = props.align === 'left' || props.align === 'right' || props.align === 'center'
    ? props.align
    : undefined;
  const imageStyle: React.CSSProperties = {
    ...(safeWidth ? { width: safeWidth } : {}),
    ...(align === 'center' ? { display: 'block', marginLeft: 'auto', marginRight: 'auto' } : {}),
    ...(align === 'right' ? { display: 'block', marginLeft: 'auto' } : {}),
  };
  if (SAFE_EXPORT_DATA_IMAGE_PATTERN.test(rawSrc)) {
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
  if (!safeSrc || safeSrc.startsWith('blob:') || isPublicRemoteMediaUrl(safeSrc)) {
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
    return sanitizeNoteLinkHref(value) ?? '';
  }
  return value;
}

async function waitForExportRender(container: HTMLElement): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map(async (image) => {
    if (image.complete) {
      return;
    }
    try {
      await image.decode();
    } catch {
      // Export should still continue if a remote/local image cannot be decoded.
    }
  }));
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
    <article className={cn('vlaina-note-export', className)}>
      <h1 className="vlaina-note-export-title">{title}</h1>
      <div className="vlaina-note-export-body">
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
  host.style.position = 'absolute';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${EXPORT_WIDTH_PX}px`;
  host.style.background = '#fff';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const style = document.createElement('style');
  style.textContent = EXPORT_CSS;
  host.appendChild(style);

  const mount = document.createElement('div');
  host.appendChild(mount);

  const root = createRoot(mount);
  root.render(<NoteExportDocument markdown={markdown} title={title} />);
  await waitForExportRender(host);

  const element = host.querySelector('.vlaina-note-export') as HTMLElement | null;
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
      `<style>${EXPORT_CSS}</style>`,
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
