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
  themeColorTokens,
  themeDomStyleTokens,
  themeExportLayoutTokens,
  themeFontWeightTokens,
  themeRadiusTokens,
  themeStyleResetTokens,
  themeTypographyTokens,
} from '@/styles/themeTokens';
import {
  isPublicRemoteMediaUrl,
  sanitizeNoteLinkHref,
  sanitizeNoteMediaSrc,
} from '@/lib/notes/markdown/urlSecurity';
import { cn } from '@/lib/utils';

const EXPORT_WIDTH_PX = themeExportLayoutTokens.widthPx;

const EXPORT_CSS = `
  :root {
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: ${themeColorTokens.exportText};
    background: ${themeColorTokens.exportSurface};
  }
  body {
    margin: ${themeExportLayoutTokens.pageMargin};
    background: ${themeColorTokens.exportSurface};
  }
  .note-export {
    box-sizing: border-box;
    width: ${EXPORT_WIDTH_PX}px;
    margin: ${themeExportLayoutTokens.documentMargin};
    padding: ${themeExportLayoutTokens.documentPadding};
    background: ${themeColorTokens.exportSurface};
  }
  .note-export h1.note-export-title {
    margin: ${themeExportLayoutTokens.titleMargin};
    font-size: ${themeTypographyTokens.exportTitleFontSize};
    line-height: ${themeTypographyTokens.exportTitleLineHeight};
    font-weight: ${themeFontWeightTokens.bold};
  }
  .note-export-body {
    font-size: ${MARKDOWN_BODY_FONT_SIZE}px;
    line-height: ${themeTypographyTokens.exportBodyLineHeight};
    overflow-wrap: anywhere;
  }
  .note-export-body h1,
  .note-export-body h2,
  .note-export-body h3,
  .note-export-body h4 {
    margin: ${themeExportLayoutTokens.headingMargin};
    line-height: ${themeTypographyTokens.exportHeadingLineHeight};
  }
  .note-export-body h1 { font-size: ${themeTypographyTokens.exportHeading1FontSize}; }
  .note-export-body h2 { font-size: ${themeTypographyTokens.exportHeading2FontSize}; }
  .note-export-body h3 { font-size: ${themeTypographyTokens.exportHeading3FontSize}; }
  .note-export-body p,
  .note-export-body ul,
  .note-export-body ol,
  .note-export-body blockquote,
  .note-export-body pre,
  .note-export-body table {
    margin: ${themeExportLayoutTokens.blockMargin};
  }
  .note-export-body blockquote {
    border-left: ${themeExportLayoutTokens.blockquoteBorderLeft} solid ${themeColorTokens.exportBorder};
    padding-left: ${themeExportLayoutTokens.blockquotePaddingLeft};
    color: ${themeColorTokens.exportMutedText};
  }
  .note-export-body code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: ${themeTypographyTokens.exportCodeFontSize};
    background: ${themeColorTokens.exportCodeSurface};
    border-radius: ${themeRadiusTokens.px4};
    padding: ${themeExportLayoutTokens.inlineCodePadding};
  }
  .note-export-body pre {
    overflow: auto;
    background: ${themeColorTokens.exportCodeSurface};
    border-radius: ${themeRadiusTokens.px6};
    padding: ${themeExportLayoutTokens.prePadding};
  }
  .note-export-body pre code {
    background: transparent;
    padding: ${themeExportLayoutTokens.preCodePadding};
  }
  .note-export-body img {
    max-width: ${themeExportLayoutTokens.mediaMaxWidth};
    height: ${themeExportLayoutTokens.mediaHeight};
    border-radius: ${themeRadiusTokens.px6};
  }
  .note-export-body [data-text-align='center'] {
    text-align: center;
  }
  .note-export-body [data-text-align='right'] {
    text-align: right;
  }
  .note-export-body table {
    width: ${themeExportLayoutTokens.tableWidth};
    border-collapse: collapse;
  }
  .note-export-body th,
  .note-export-body td {
    border: ${themeExportLayoutTokens.tableBorderWidth} solid ${themeColorTokens.exportBorder};
    padding: ${themeExportLayoutTokens.tableCellPadding};
    vertical-align: top;
  }
  .note-export-body th {
    background: ${themeColorTokens.exportCodeSurface};
    font-weight: ${themeFontWeightTokens.semibold};
  }
  @page {
    margin: ${themeExportLayoutTokens.pageMargin};
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
  style.textContent = EXPORT_CSS;
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
